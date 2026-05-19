import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Book } from '../books/entities/book.entity';
import { IndexBuilder, QueryEngine, createDocumentsFromChapters } from './llama';
import { initializeLlamaIndex } from './llama/settings';
import { FileParserService } from '../books/services/file-parser.service';

// Initialize LlamaIndex settings at module load time (before any service instantiation)
initializeLlamaIndex();

/**
 * RAG Service - Retrieval Augmented Generation
 * 
 * Uses LlamaIndex.TS with PGVectorStore for semantic search:
 * - HuggingFace local embedding (free, privacy-preserving)
 * - pgvector for vector storage and search
 * - SentenceSplitter for semantic chunking
 * 
 * This service is used by ChatService when RAG is enabled.
 */
@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private indexBuilder: IndexBuilder;
  private queryEngines: Map<string, QueryEngine> = new Map();
  private isInitialized = false;

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
  }

  async onModuleInit() {
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.logger.log('Initializing LlamaIndex...');
    
    // Initialize PGVectorStore
    await this.indexBuilder.initialize();
    
    this.isInitialized = true;
    this.logger.log('LlamaIndex initialized successfully');
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

    // Create query engine
    const queryEngine = new QueryEngine(this.indexBuilder, index);
    this.queryEngines.set(bookId, queryEngine);

    const chunksIndexed = documents.length;
    this.logger.log(`Book processed: ${chunksIndexed} chunks indexed for ${bookId}`);

    return { chunksIndexed };
  }

  /**
   * Retrieve relevant context for a query.
   */
  async retrieve(
    query: string,
    bookIds: string[],
  ): Promise<RetrievalResult> {
    await this.initialize();

    if (bookIds.length === 0) {
      throw new Error('At least one bookId is required');
    }

    // Load index from pgvector (Map may be empty after app restart)
    const index = await this.indexBuilder.loadIndex();

    // Query using LlamaIndex
    const result = await this.indexBuilder.query(index, query, { topK: 10 });

    // Get book titles
    const bookTitles = new Map<string, string>();
    const uniqueBookIds = [...new Set(result.sources.map(s => s.bookId).filter(Boolean))];
    
    if (uniqueBookIds.length > 0) {
      const books = await this.bookRepository.find({
        where: { id: In(uniqueBookIds) },
      });
      books.forEach((book) => {
        bookTitles.set(book.id, book.title || 'Unknown');
      });
    }

    // Format citations
    const citations: Citation[] = result.sources.map(s => ({
      bookId: s.bookId,
      chunkId: '',
      bookTitle: s.bookTitle || bookTitles.get(s.bookId),
      chapter: s.chapter,
      excerpt: s.content.substring(0, 200),
      relevanceScore: s.score,
    }));

    return {
      context: {
        context: result.sources.map(s => s.content).join('\n\n---\n\n'),
        citations,
        citationString: citations.map((c, i) => `[${i + 1}] ${c.bookTitle}${c.chapter ? ', ' + c.chapter : ''}`).join('\n'),
        tokensUsed: 0,
        chunksUsed: result.sources.length,
      },
      bookTitles,
      queryExpansion: null,
      vectorResultsCount: result.sources.length,
      keywordResultsCount: 0,
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
5. If the topic is not covered in the provided content, say so honestly
6. Maintain context from the conversation history

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
      this.queryEngines.delete(bookId);
      this.logger.log(`Deleted index for book: ${bookId}`);
    } catch (error: any) {
      this.logger.warn(`Failed to delete index for book ${bookId}: ${error.message}`);
    }
  }

  /**
   * Check if a book has an index.
   */
  async hasIndex(bookId: string): Promise<boolean> {
    return this.queryEngines.has(bookId);
  }
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
    strategy: 'semantic' | 'keyword' | 'hybrid';
    expandedQuery: string;
  } | null;
  vectorResultsCount: number;
  keywordResultsCount: number;
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
