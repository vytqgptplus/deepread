/**
 * Query Engine
 * 
 * High-level wrapper for querying LlamaIndex with RAG.
 */

import { Logger } from '@nestjs/common';
import { VectorStoreIndex, MetadataMode } from 'llamaindex';
import { IndexBuilder, QueryResult, SourceNode } from './index-builder';

export interface StreamQueryResult {
  content: string;
  sources: SourceNode[];
}

export class QueryEngine {
  private readonly logger = new Logger(QueryEngine.name);

  constructor(
    private indexBuilder: IndexBuilder,
    private index: VectorStoreIndex,
  ) {}

  /**
   * Query with RAG - retrieve relevant chunks and synthesize answer.
   */
  async query(
    question: string,
    options: { topK?: number } = {},
  ): Promise<QueryResult> {
    const { topK = 10 } = options;
    return this.indexBuilder.query(this.index, question, { topK });
  }

  /**
   * Retrieve chunks without synthesis (for debugging/inspection).
   */
  async retrieve(question: string, topK = 10) {
    return this.indexBuilder.retrieve(this.index, question, topK);
  }

  /**
   * Get the underlying index.
   */
  getIndex(): VectorStoreIndex {
    return this.index;
  }
}
