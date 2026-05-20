/**
 * Production RAG Service - DeepRead
 * 
 * Implements production-grade RAG pipeline following LlamaIndex best practices:
 * 
 * Architecture:
 * 1. Document Processing: Chunking with metadata enrichment
 * 2. Indexing: Vector + BM25 index
 * 3. Query Routing: Intelligent strategy selection
 * 4. Retrieval: Hybrid search (BM25 + Vector) with RRF
 * 5. Reranking: Cross-encoder for precision
 * 6. Synthesis: Context assembly with citations
 * 
 * Production Features:
 * - Comprehensive observability (retrieval quality metrics)
 * - Graceful degradation (fallbacks for each component)
 * - Proper error handling and logging
 * - Query type classification and strategy selection
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Document } from 'llamaindex';
import { Book } from '../books/entities/book.entity';
import { IndexBuilder, QueryEngine, createDocumentsFromChapters } from './llama';
import { initializeLlamaIndex } from './llama/settings';
import { HybridRetriever } from './llama/hybrid-retriever';
import { IndexedDocument } from './llama/bm25-retriever';
import { CrossEncoderReranker, RerankResult } from './llama/reranker';
import { QueryRouter, QueryType } from './llama/query-router';
import { FileParserService } from '../books/services/file-parser.service';
import { NodeWithScore } from 'llamaindex';

// Initialize LlamaIndex settings at module load time
initializeLlamaIndex();

/**
 * RAG Service Configuration
 */
interface RAGConfig {
  /** Initial retrieval candidates */
  hybridTopK: number;
  /** Final results after reranking */
  rerankTopN: number;
  /** Enable query routing */
  enableRouting: boolean;
  /** Enable reranking */
  enableReranking: boolean;
  /** Minimum relevance score threshold */
  minRelevanceScore: number;
}

/**
 * Production RAG Service
 */
@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  
  // Core components
  private indexBuilder: IndexBuilder;
  private hybridRetriever: HybridRetriever | null = null;
  private reranker: CrossEncoderReranker;
  private queryRouter: QueryRouter;
  
  // State
  private isInitialized = false;
  private indexedDocuments: IndexedDocument[] = [];
  
  // Configuration
  private readonly config: RAGConfig = {
    hybridTopK: 30,        // Initial candidates for good recall
    rerankTopN: 5,        // Final results for LLM context
    enableRouting: true,   // Enable intelligent routing
    enableReranking: true, // Enable cross-encoder reranking
    minRelevanceScore: 0.3, // Filter low-relevance results
  };

  constructor(
    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,
    private readonly configService: ConfigService,
    private readonly fileParserService: FileParserService,
  ) {
    // Initialize IndexBuilder with pgvector config
    this.indexBuilder = new IndexBuilder({
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: parseInt(this.configService.get<string>('DB_PORT', '9432') || '9432', 10),
      database: this.configService.get<string>('DB_NAME', 'deepread'),
      user: this.configService.get<string>('DB_USER', 'deepread'),
      password: this.configService.get<string>('DB_PASSWORD', 'deepread_secret'),
    });

    // Initialize production reranker
    this.reranker = new CrossEncoderReranker({
      topN: this.config.rerankTopN,
    });

    // Initialize query router
    this.queryRouter = new QueryRouter({
      useLLMRouting: false, // Use rule-based routing for now
      expandQueries: true,
    });

    this.logger.log('RAG Service configuration initialized');
    this.logger.log(`Config: topK=${this.config.hybridTopK}, rerank=${this.config.rerankTopN}, routing=${this.config.enableRouting}`);
  }

  async onModuleInit() {
    await this.initialize();
  }

  /**
   * Initialize RAG components.
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.logger.log('Initializing RAG Service...');
    
    // Initialize PGVectorStore
    await this.indexBuilder.initialize();
    
    // Initialize hybrid retriever with empty index (will be populated on first retrieval)
    // The BM25 index needs documents, so we initialize with what we have
    const index = await this.indexBuilder.loadIndex();
    this.hybridRetriever = new HybridRetriever(index, {
      topK: this.config.hybridTopK,
      vectorWeight: 0.6,
      bm25Weight: 0.4,
    });

    this.isInitialized = true;
    this.logger.log('RAG Service initialized successfully');
  }

  /**
   * Process a book and create index in pgvector.
   */
  async processBook(bookId: string, content: string): Promise<{ chunksIndexed: number }> {
    await this.initialize();

    this.logger.log(`Processing book for RAG: ${bookId}`);

    // Get book info
    const book = await this.bookRepository.findOne({ where: { id: bookId } });
    if (!book) {
      throw new Error(`Book not found: ${bookId}`);
    }

    // Extract chapters from content
    const chapters = this.fileParserService.extractChapters(content);
    this.logger.log(`Extracted ${chapters.length} chapters`);

    // Create LlamaIndex Documents from chapters
    const documents = createDocumentsFromChapters(
      bookId,
      book.title || 'Unknown',
      chapters.map(c => ({ title: c.chapter, content: c.content })),
    );

    this.logger.log(`Created ${documents.length} documents`);

    // Build index (handles: chunking -> embedding -> storing in pgvector)
    const index = await this.indexBuilder.buildIndex(documents);

    // Update hybrid retriever
    await this.initializeHybridRetriever(index);

    // Add documents to BM25 index
    this.indexDocumentsForBM25(documents, bookId);

    const chunksIndexed = documents.length;
    this.logger.log(`Book processed: ${chunksIndexed} chunks indexed for ${bookId}`);

    return { chunksIndexed };
  }

  /**
   * Initialize hybrid retriever with fresh index.
   */
  private async initializeHybridRetriever(index: any): Promise<void> {
    this.hybridRetriever = new HybridRetriever(index, {
      topK: this.config.hybridTopK,
      vectorWeight: 0.6,
      bm25Weight: 0.4,
    });

    // Initialize BM25 with all indexed documents
    if (this.indexedDocuments.length > 0) {
      this.hybridRetriever.initBM25(this.indexedDocuments);
    }

    this.logger.log('Hybrid retriever re-initialized');
  }

  /**
   * Index documents in BM25 for keyword search.
   */
  private indexDocumentsForBM25(documents: Document[], bookId: string): void {
    for (const doc of documents) {
      const docText = doc.text || '';
      
      if (!docText || docText.trim().length === 0) {
        this.logger.warn(`Skipping empty document for book ${bookId}`);
        continue;
      }

      const indexedDoc: IndexedDocument = {
        id: doc.id_ || `${bookId}-${this.indexedDocuments.length}`,
        text: docText,
        metadata: {
          bookId,
          ...doc.metadata,
        },
      };
      
      this.indexedDocuments.push(indexedDoc);
      
      if (this.hybridRetriever) {
        this.hybridRetriever.addToBM25(indexedDoc);
      }
    }
    
    this.logger.debug(`BM25 index updated: ${this.indexedDocuments.length} total documents`);
    this.logger.debug(`Last indexed doc preview: "${this.indexedDocuments[this.indexedDocuments.length - 1]?.text?.substring(0, 100)}..."`);
  }

  /**
   * Production Retrieval Method
   * 
   * Implements full RAG pipeline:
   * 1. Query analysis and routing
   * 2. Hybrid retrieval (BM25 + Vector + RRF)
   * 3. Cross-encoder reranking
   * 4. Context assembly with citations
   */
  async retrieve(
    query: string,
    bookIds: string[],
  ): Promise<RetrievalResult> {
    await this.initialize();

    if (bookIds.length === 0) {
      throw new Error('At least one bookId is required');
    }

    const retrievalStartTime = Date.now();
    
    this.logger.log(`=== Retrieval Start ===`);
    this.logger.log(`Query: "${query.substring(0, 100)}..."`);
    this.logger.log(`Books: ${bookIds.join(', ')}`);

    // Step 1: Query Analysis and Routing
    const routingDecision = this.config.enableRouting
      ? this.queryRouter.route(query)
      : {
          queryType: QueryType.GENERAL,
          strategies: [{ name: 'hybrid', description: 'Hybrid search', score: 1 }],
          expandedQueries: [query],
          recommendedTopK: this.config.hybridTopK,
        };

    this.logger.log(`Query type: ${routingDecision.queryType}`);
    this.logger.log(`Strategy: ${routingDecision.strategies[0]?.name || 'hybrid'}`);

    // Step 2: Load index
    const index = await this.indexBuilder.loadIndex();

    // Step 3: Initialize hybrid retriever if needed
    if (!this.hybridRetriever) {
      this.hybridRetriever = new HybridRetriever(index, {
        topK: this.config.hybridTopK,
      });
      
      // Initialize BM25 with documents if available
      if (this.indexedDocuments.length > 0) {
        this.hybridRetriever.initBM25(this.indexedDocuments);
      }
    }

    // Step 4: Hybrid Retrieval
    let retrievedNodes: NodeWithScore[] = [];
    let retrievalMetrics: RetrievalMetrics = {
      vectorCandidates: 0,
      bm25Candidates: 0,
      hybridCandidates: 0,
    };

    try {
      // Use expanded queries for better recall
      const queriesToSearch = routingDecision.expandedQueries;
      
      for (const searchQuery of queriesToSearch) {
        const results = await this.hybridRetriever.retrieve(
          searchQuery,
          this.config.hybridTopK
        );
        
        // Deduplicate and merge results
        for (const node of results) {
          const existingIndex = retrievedNodes.findIndex(
            n => (n as any).node?.id_ === (node as any).node?.id_
          );
          if (existingIndex === -1) {
            retrievedNodes.push(node as any);
          } else if (node.score !== undefined && retrievedNodes[existingIndex].score !== undefined &&
                     node.score > retrievedNodes[existingIndex].score!) {
            retrievedNodes[existingIndex] = node as any;
          }
        }
      }

      retrievalMetrics.hybridCandidates = retrievedNodes.length;
      this.logger.log(`Hybrid retrieval: ${retrievedNodes.length} candidates`);
    } catch (error: any) {
      this.logger.error(`Hybrid retrieval failed: ${error.message}`);
      
      // Fallback to vector-only
      try {
        const retriever = index.asRetriever({ similarityTopK: this.config.hybridTopK });
        retrievedNodes = await retriever.retrieve({ queryStr: query } as any);
        retrievalMetrics.vectorCandidates = retrievedNodes.length;
        this.logger.log(`Fallback to vector: ${retrievedNodes.length} results`);
      } catch (fallbackError: any) {
        this.logger.error(`Vector fallback failed: ${fallbackError.message}`);
        return this.emptyResult(query, retrievalStartTime);
      }
    }

    // Step 5: Reranking (if enabled)
    let rerankResult: RerankResult | null = null;
    let finalNodes: any[] = retrievedNodes;

    if (this.config.enableReranking && retrievedNodes.length > 0) {
      try {
        rerankResult = await this.reranker.rerank(
          query,
          retrievedNodes as any,
          this.config.rerankTopN
        );
        
        finalNodes = rerankResult.nodes;
        this.logger.log(
          `Reranking: ${rerankResult.metrics.originalCount} -> ${rerankResult.metrics.rerankedCount} results`
        );
      } catch (error: any) {
        this.logger.warn(`Reranking failed: ${error.message}`);
        finalNodes = retrievedNodes.slice(0, this.config.rerankTopN);
      }
    }

    // Step 6: Format results
    const retrievalTime = Date.now() - retrievalStartTime;
    const sources = this.formatSources(finalNodes);

    // Get book titles
    const bookTitles = await this.getBookTitles(sources.map(s => s.bookId));

    // Build citations
    const citations: Citation[] = sources.map(s => ({
      bookId: s.bookId,
      chunkId: '',
      bookTitle: s.bookTitle || bookTitles.get(s.bookId) || 'Unknown',
      chapter: s.chapter,
      excerpt: s.content.substring(0, 200),
      relevanceScore: s.score,
    }));

    this.logger.log(`=== Retrieval Complete ===`);
    this.logger.log(`Time: ${retrievalTime}ms`);
    this.logger.log(`Final results: ${sources.length}`);
    this.logger.log(`========================`);

    return {
      context: {
        context: sources.map(s => s.content).join('\n\n---\n\n'),
        citations,
        citationString: citations.map((c, i) => `[${i + 1}] ${c.bookTitle}${c.chapter ? ', ' + c.chapter : ''}`).join('\n'),
        tokensUsed: 0,
        chunksUsed: sources.length,
      },
      bookTitles,
      queryExpansion: {
        original: query,
        keywords: routingDecision.expandedQueries,
        concepts: [],
        variations: routingDecision.expandedQueries.slice(1),
        strategy: routingDecision.strategies[0]?.name as any || 'hybrid',
        expandedQuery: routingDecision.expandedQueries.join(' | '),
      },
      vectorResultsCount: retrievalMetrics.vectorCandidates || retrievalMetrics.hybridCandidates,
      keywordResultsCount: retrievalMetrics.bm25Candidates || 0,
      retrievalMetadata: {
        retrievalTimeMs: retrievalTime,
        queryType: routingDecision.queryType,
        initialCandidates: retrievedNodes.length,
        finalResults: sources.length,
        vectorCount: retrievalMetrics.vectorCandidates || 0,
        bm25Count: retrievalMetrics.bm25Candidates || 0,
        hybridCount: retrievalMetrics.hybridCandidates || 0,
        rerankingTimeMs: rerankResult?.metrics.rerankingTimeMs || 0,
        rerankingScores: rerankResult?.metrics.scores || [],
      },
    };
  }

  /**
   * Format retrieved nodes to SourceNode array.
   */
  private formatSources(nodes: NodeWithScore[]): SourceNode[] {
    return nodes.map((node, index) => ({
      bookId: node.node?.metadata?.bookId || '',
      bookTitle: node.node?.metadata?.bookTitle || '',
      chapter: node.node?.metadata?.chapter || '',
      content: (node.node as any)?.textContent || (node.node as any)?.text || '',
      score: node.score || 0,
      metadata: {
        retrievalSources: (node as any).metadata?.retrievalSources || [],
        rank: index + 1,
      },
    }));
  }

  /**
   * Get book titles for a list of book IDs.
   */
  private async getBookTitles(bookIds: string[]): Promise<Map<string, string>> {
    const titles = new Map<string, string>();
    const uniqueIds = [...new Set(bookIds.filter(Boolean))];
    
    if (uniqueIds.length > 0) {
      const books = await this.bookRepository.find({
        where: { id: In(uniqueIds) },
      });
      books.forEach(book => {
        titles.set(book.id, book.title || 'Unknown');
      });
    }
    
    return titles;
  }

  /**
   * Return empty result for error cases.
   */
  private emptyResult(query: string, startTime: number): RetrievalResult {
    return {
      context: {
        context: '',
        citations: [],
        citationString: '',
        tokensUsed: 0,
        chunksUsed: 0,
      },
      bookTitles: new Map(),
      queryExpansion: {
        original: query,
        keywords: [],
        concepts: [],
        variations: [],
        strategy: 'hybrid',
        expandedQuery: query,
      },
      vectorResultsCount: 0,
      keywordResultsCount: 0,
      retrievalMetadata: {
        retrievalTimeMs: Date.now() - startTime,
        queryType: QueryType.GENERAL,
        initialCandidates: 0,
        finalResults: 0,
        vectorCount: 0,
        bm25Count: 0,
        hybridCount: 0,
        rerankingTimeMs: 0,
        rerankingScores: [],
      },
    };
  }

  /**
   * Build prompt with context for AI.
   */
  buildPromptWithContext(
    query: string,
    retrievalResult: RetrievalResult,
  ): { systemPrompt: string; userPrompt: string; citations: Citation[] } {
    let contextSection = '';

    if (retrievalResult.context.chunksUsed > 0) {
      contextSection = `
You have access to the following relevant content from the user's books:

${retrievalResult.context.context}

Use this content to answer the user's question. When referencing specific passages, cite them using the format [source: book_title, chapter: X].
`;
    }

    const systemPrompt = `You are an AI assistant for DeepRead, an AI-powered book reading platform.

Your role is to help users understand and discuss book content.

Guidelines:
1. Answer based on the provided book content when available
2. Cite sources using the format [Book Title, Chapter X] when referencing specific content
3. Be helpful and informative, providing accurate information from the books
4. If the topic is not covered in the provided content, say so honestly
5. Maintain context from the conversation history

${contextSection}

Remember: Always cite your sources when using information from the books.`;

    const userPrompt = `Question: ${query}

${retrievalResult.context.citationString}`;

    return { systemPrompt, userPrompt, citations: retrievalResult.context.citations };
  }

  /**
   * Delete book index.
   */
  async deleteBook(bookId: string): Promise<void> {
    await this.initialize();

    try {
      const index = await this.indexBuilder.loadIndex();
      await this.indexBuilder.deleteByBookId(index, bookId);
      
      // Remove from BM25 index
      this.indexedDocuments = this.indexedDocuments.filter(
        doc => doc.metadata?.bookId !== bookId
      );
      
      this.logger.log(`Deleted index for book: ${bookId}`);
    } catch (error: any) {
      this.logger.warn(`Failed to delete index for book ${bookId}: ${error.message}`);
    }
  }

  /**
   * Check if a book has an index.
   */
  async hasIndex(bookId: string): Promise<boolean> {
    return this.indexedDocuments.some(doc => doc.metadata?.bookId === bookId);
  }

  /**
   * Get retrieval statistics for monitoring.
   */
  getStats(): RAGStats {
    return {
      totalDocuments: this.indexedDocuments.length,
      hybridRetrieverReady: this.hybridRetriever !== null,
      rerankerReady: true, // Always ready (has fallback)
      routingEnabled: this.config.enableRouting,
      rerankingEnabled: this.config.enableReranking,
    };
  }
}

/**
 * Source node with metadata.
 */
interface SourceNode {
  bookId: string;
  bookTitle: string;
  chapter?: string;
  content: string;
  score: number;
  metadata?: {
    retrievalSources?: string[];
    rank?: number;
  };
}

/**
 * Retrieval metrics for observability.
 */
interface RetrievalMetrics {
  vectorCandidates: number;
  bm25Candidates: number;
  hybridCandidates: number;
}

/**
 * RAG statistics.
 */
interface RAGStats {
  totalDocuments: number;
  hybridRetrieverReady: boolean;
  rerankerReady: boolean;
  routingEnabled: boolean;
  rerankingEnabled: boolean;
}

/**
 * Result of retrieval operation.
 */
export interface RetrievalResult {
  context: {
    context: string;
    citations: Citation[];
    citationString: string;
    tokensUsed: number;
    chunksUsed: number;
  };
  bookTitles: Map<string, string>;
  queryExpansion: {
    original: string;
    keywords: string[];
    concepts: string[];
    variations: string[];
    strategy: 'semantic' | 'keyword' | 'hybrid' | 'summary' | 'comparison';
    expandedQuery: string;
  };
  vectorResultsCount: number;
  keywordResultsCount: number;
  retrievalMetadata?: {
    retrievalTimeMs: number;
    queryType: QueryType;
    initialCandidates: number;
    finalResults: number;
    vectorCount: number;
    bm25Count: number;
    hybridCount: number;
    rerankingTimeMs: number;
    rerankingScores: {
      nodeId: string;
      rerankScore: number;
      originalRank: number;
      newRank: number;
      scoreDelta: number;
    }[];
  };
}

/**
 * Citation type for exports.
 */
export interface Citation {
  bookId: string;
  chunkId: string;
  bookTitle?: string;
  chapter?: string;
  page?: number;
  excerpt?: string;
  relevanceScore?: number;
}
