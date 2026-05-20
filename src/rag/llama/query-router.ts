/**
 * Production Query Router - Intelligent query strategy selection
 * 
 * Implements LlamaIndex's RouterQueryEngine pattern for production RAG.
 */

import { Logger } from '@nestjs/common';

export interface QueryStrategy {
  name: string;
  description: string;
  score: number;
}

/**
 * Query type classification based on query characteristics.
 */
export enum QueryType {
  /** Specific factual questions */
  FACTUAL = 'factual',
  /** Queries about definitions or concepts */
  DEFINITION = 'definition',
  /** Queries asking for summaries */
  SUMMARY = 'summary',
  /** Queries comparing multiple items */
  COMPARISON = 'comparison',
  /** Queries about processes or steps */
  PROCEDURAL = 'procedural',
  /** General queries (default) */
  GENERAL = 'general',
}

/**
 * Query Router Configuration
 */
export interface QueryRouterConfig {
  /** Enable LLM-based routing when available */
  useLLMRouting?: boolean;
  /** Enable automatic query expansion */
  expandQueries?: boolean;
  /** Minimum confidence threshold for routing */
  confidenceThreshold?: number;
}

/**
 * Query Router
 * 
 * Implements intelligent routing based on query characteristics.
 * 
 * Routing Rules:
 * - Contains question words (ai sao, là gì, như thế nào) -> FACTUAL
 * - Contains comparison words (so sánh, khác nhau, hơn) -> COMPARISON
 * - Contains summary indicators (tóm tắt, tổng quan, giới thiệu) -> SUMMARY
 * - Contains definition words (định nghĩa, là gì, nghĩa là) -> DEFINITION
 * - Contains procedural words (cách, các bước, quy trình) -> PROCEDURAL
 * - Default -> GENERAL
 */
export class QueryRouter {
  private readonly logger = new Logger(QueryRouter.name);
  private readonly config: Required<QueryRouterConfig>;

  // Query pattern indicators
  private readonly patterns = {
    factual: [
      'ai', 'ở đâu', 'khi nào', 'bao giờ', 'bao lâu',
      'who', 'where', 'when', 'how long', 'how many',
      'what happened', 'describe', 'explain',
    ],
    definition: [
      'là gì', 'nghĩa là', 'định nghĩa', 'khái niệm',
      'what is', 'means', 'definition', 'concept',
    ],
    summary: [
      'tóm tắt', 'tổng quan', 'giới thiệu', 'sơ lược',
      'summarize', 'overview', 'summary', 'introduction',
    ],
    comparison: [
      'so sánh', 'khác nhau', 'hơn', 'kém',
      'compare', 'difference', 'versus', 'vs', 'between',
    ],
    procedural: [
      'cách', 'các bước', 'quy trình', 'phương pháp', 'làm sao',
      'how to', 'steps', 'process', 'method', 'procedure',
    ],
  };

  constructor(config: QueryRouterConfig = {}) {
    this.config = {
      useLLMRouting: config.useLLMRouting ?? false,
      expandQueries: config.expandQueries ?? true,
      confidenceThreshold: config.confidenceThreshold ?? 0.5,
    };

    this.logger.log(
      `QueryRouter initialized: llmRouting=${this.config.useLLMRouting}, ` +
      `expand=${this.config.expandQueries}`
    );
  }

  /**
   * Classify query type based on content analysis.
   */
  classifyQuery(query: string): QueryType {
    const lowerQuery = query.toLowerCase();
    const scores: Record<QueryType, number> = {
      [QueryType.FACTUAL]: 0,
      [QueryType.DEFINITION]: 0,
      [QueryType.SUMMARY]: 0,
      [QueryType.COMPARISON]: 0,
      [QueryType.PROCEDURAL]: 0,
      [QueryType.GENERAL]: 0,
    };

    // Score each category based on pattern matching
    for (const [type, keywords] of Object.entries(this.patterns)) {
      for (const keyword of keywords) {
        if (lowerQuery.includes(keyword)) {
          scores[type as QueryType] += 1;
        }
      }
    }

    // Find highest scoring category
    let maxType = QueryType.GENERAL;
    let maxScore = 0;

    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxType = type as QueryType;
      }
    }

    // If no patterns matched, default to general
    if (maxScore === 0) {
      maxType = QueryType.GENERAL;
    }

    this.logger.debug(`Query classified as: ${maxType} (score: ${maxScore})`);
    
    return maxType;
  }

  /**
   * Get retrieval strategy for a query type.
   */
  getStrategy(queryType: QueryType): QueryStrategy[] {
    switch (queryType) {
      case QueryType.FACTUAL:
        return [
          { name: 'hybrid', description: 'Hybrid BM25 + Vector search', score: 0.9 },
          { name: 'rerank', description: 'With reranking', score: 0.8 },
        ];

      case QueryType.DEFINITION:
        return [
          { name: 'vector', description: 'Vector semantic search', score: 0.9 },
          { name: 'hybrid', description: 'Hybrid search', score: 0.7 },
        ];

      case QueryType.SUMMARY:
        return [
          { name: 'parent_doc', description: 'Return parent documents', score: 0.9 },
          { name: 'hybrid', description: 'Hybrid search', score: 0.6 },
        ];

      case QueryType.COMPARISON:
        return [
          { name: 'hybrid', description: 'Hybrid search', score: 0.9 },
          { name: 'multi_retrieve', description: 'Multiple passes', score: 0.8 },
          { name: 'rerank', description: 'With reranking', score: 0.7 },
        ];

      case QueryType.PROCEDURAL:
        return [
          { name: 'hybrid', description: 'Hybrid search', score: 0.9 },
          { name: 'vector', description: 'Vector semantic search', score: 0.7 },
        ];

      case QueryType.GENERAL:
      default:
        return [
          { name: 'hybrid', description: 'Hybrid search', score: 0.9 },
          { name: 'rerank', description: 'With reranking', score: 0.7 },
        ];
    }
  }

  /**
   * Expand query with variations.
   * This helps capture different phrasings of the same concept.
   */
  expandQuery(query: string): string[] {
    if (!this.config.expandQueries) {
      return [query];
    }

    const expansions: string[] = [query];
    const lowerQuery = query.toLowerCase();

    // Add interrogative variations
    if (!lowerQuery.includes('cách') && !lowerQuery.includes('làm')) {
      expansions.push(`cách ${query}`);
    }
    
    if (!lowerQuery.includes('như thế nào')) {
      expansions.push(`${query} như thế nào`);
    }

    // Add definition variations
    if (!lowerQuery.includes('là gì') && !lowerQuery.includes('định nghĩa')) {
      expansions.push(`định nghĩa ${query}`);
    }

    // Add summary variations
    if (!lowerQuery.includes('tóm tắt') && !lowerQuery.includes('tổng quan')) {
      expansions.push(`tóm tắt ${query}`);
    }

    // Remove duplicates
    return [...new Set(expansions)];
  }

  /**
   * Analyze query and return routing decision.
   */
  route(query: string): {
    queryType: QueryType;
    strategies: QueryStrategy[];
    expandedQueries: string[];
  } {
    const queryType = this.classifyQuery(query);
    const strategies = this.getStrategy(queryType);
    const expandedQueries = this.expandQuery(query);

    this.logger.debug(
      `Routing decision: type=${queryType}, ` +
      `strategies=${strategies.map(s => s.name).join(',')}, ` +
      `expansions=${expandedQueries.length}`
    );

    return {
      queryType,
      strategies,
      expandedQueries,
    };
  }
}

/**
 * Query Engine Wrapper with Routing
 * 
 * Wraps multiple query engines and routes based on query type.
 */
export class RouterQueryEngine {
  private readonly logger = new Logger(RouterQueryEngine.name);
  private router: QueryRouter;

  constructor(config: QueryRouterConfig = {}) {
    this.router = new QueryRouter(config);
  }

  /**
   * Route and execute query.
   * Returns routing decision for external execution.
   */
  route(query: string): {
    queryType: QueryType;
    strategies: QueryStrategy[];
    expandedQueries: string[];
    recommendedTopK: number;
  } {
    const routing = this.router.route(query);

    // Determine appropriate topK based on query type
    let recommendedTopK = 10;
    switch (routing.queryType) {
      case QueryType.SUMMARY:
        recommendedTopK = 5;
        break;
      case QueryType.COMPARISON:
        recommendedTopK = 15;
        break;
      case QueryType.FACTUAL:
        recommendedTopK = 10;
        break;
      default:
        recommendedTopK = 10;
    }

    return {
      ...routing,
      recommendedTopK,
    };
  }
}
