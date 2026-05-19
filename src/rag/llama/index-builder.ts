/**
 * Index Builder
 * 
 * Manages LlamaIndex VectorStoreIndex with PGVectorStore.
 * Handles document indexing, retrieval, and deletion.
 */

import { Logger } from '@nestjs/common';
import {
  VectorStoreIndex,
  Document,
  storageContextFromDefaults,
  MetadataMode,
  Settings,
} from 'llamaindex';
import { PGVectorStore } from '@llamaindex/postgres';

export interface QueryResult {
  answer: string;
  sources: SourceNode[];
}

export interface SourceNode {
  bookId: string;
  bookTitle: string;
  chapter?: string;
  content: string;
  score: number;
}

export interface PGConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export class IndexBuilder {
  private readonly logger = new Logger(IndexBuilder.name);
  private vectorStore: PGVectorStore;
  private storageContext: Awaited<ReturnType<typeof storageContextFromDefaults>> | null = null;
  private initialized = false;

  constructor(private config: PGConfig, private dimensions = 384) {
    this.vectorStore = new PGVectorStore({
      clientConfig: {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
      },
      dimensions: this.dimensions,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.logger.log('Initializing PGVectorStore...');
    
    this.storageContext = await storageContextFromDefaults({
      vectorStore: this.vectorStore,
    });

    this.initialized = true;
    this.logger.log('PGVectorStore initialized');
  }

  /**
   * Build index from documents.
   * LlamaIndex handles: chunking -> embedding -> storing in pgvector
   */
  async buildIndex(documents: Document[]): Promise<VectorStoreIndex> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.log(`Building index with ${documents.length} documents...`);
    this.logger.log('This may take a while for the first time (downloading model)...');

    const index = await VectorStoreIndex.fromDocuments(documents, {
      storageContext: this.storageContext!,
    });

    this.logger.log('Index built successfully');
    return index;
  }

  /**
   * Load existing index from vector store.
   */
  async loadIndex(): Promise<VectorStoreIndex> {
    if (!this.initialized) {
      await this.initialize();
    }

    return VectorStoreIndex.fromVectorStore(this.vectorStore);
  }

  /**
   * Add documents to existing index.
   */
  async addDocuments(index: VectorStoreIndex, documents: Document[]): Promise<void> {
    for (const doc of documents) {
      await index.insert(doc);
    }
  }

  /**
   * Delete documents by external ID (bookId).
   */
  async deleteByBookId(index: VectorStoreIndex, bookId: string): Promise<void> {
    await index.deleteRefDoc(`book-${bookId}`);
  }

  /**
   * Query with RAG - retrieve relevant chunks (no LLM synthesis).
   * Use asRetriever instead of asQueryEngine since we use external LLM.
   */
  async query(
    index: VectorStoreIndex,
    question: string,
    options: { topK?: number } = {},
  ): Promise<QueryResult> {
    const topK = options.topK ?? 10;
    
    // Use retriever only (no LLM synthesis)
    const retriever = index.asRetriever({ similarityTopK: topK });
    const nodes = await retriever.retrieve({ query: question });

    const sources: SourceNode[] = nodes.map((node: any) => ({
      bookId: node.node?.metadata?.bookId || '',
      bookTitle: node.node?.metadata?.bookTitle || '',
      chapter: node.node?.metadata?.chapter || '',
      content: typeof node.node?.getContent === 'function'
        ? node.node.getContent(MetadataMode.NONE)
        : node.node?.text || '',
      score: node.score || 0,
    }));

    return {
      answer: sources.map(s => s.content).join('\n\n---\n\n'),
      sources,
    };
  }

  /**
   * Retrieve chunks without LLM synthesis.
   */
  async retrieve(
    index: VectorStoreIndex,
    question: string,
    topK = 10,
  ) {
    const retriever = index.asRetriever({ similarityTopK: topK });
    return await retriever.retrieve({ query: question });
  }

  /**
   * Get database client for custom queries.
   */
  async getClient(): Promise<any> {
    return await this.vectorStore.client();
  }

  /**
   * Clear all data in the vector store.
   */
  async clearAll(): Promise<void> {
    // PGVectorStore doesn't have clearAll, need to use truncate
    this.logger.warn('clearAll not supported on PGVectorStore. Use manual SQL to truncate.');
  }
}
