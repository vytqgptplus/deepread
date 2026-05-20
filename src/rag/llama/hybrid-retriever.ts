/**
 * Production-Grade Hybrid Search Retriever
 * 
 * Implements proper hybrid search combining:
 * 1. BM25Retriever - Keyword-based retrieval (Okapi BM25)
 * 2. VectorRetriever - Semantic similarity search
 * 3. Reciprocal Rank Fusion (RRF) - Rank aggregation
 * 
 * This is the production standard for RAG retrieval:
 * - BM25 handles exact keyword matches (error codes, names, technical terms)
 * - Vector handles semantic similarity (synonyms, paraphrases)
 * - RRF merges rankings without requiring score normalization
 */

import { Logger } from '@nestjs/common';
import { VectorStoreIndex, MetadataMode } from 'llamaindex';
import { BM25Retriever, IndexedDocument, NodeWithScore } from './bm25-retriever';

/**
 * Hybrid Search Retriever Configuration
 */
export interface HybridRetrieverConfig {
  /** Number of candidates to retrieve from each retriever */
  topK?: number;
  /** RRF k parameter - controls ranking sensitivity */
  rrfK?: number;
  /** Vector search weight */
  vectorWeight?: number;
  /** BM25 weight */
  bm25Weight?: number;
}

/**
 * Production Hybrid Search Retriever
 * 
 * Combines BM25 and Vector retrieval using Reciprocal Rank Fusion (RRF).
 * 
 * RRF Formula: RRF(d) = Σ 1/(k + rank(d))
 */
export class HybridRetriever {
  private readonly logger = new Logger(HybridRetriever.name);
  
  private vectorIndex: VectorStoreIndex;
  private bm25Retriever: BM25Retriever;
  
  // Configuration
  private readonly topK: number;
  private readonly rrfK: number;
  private readonly vectorWeight: number;
  private readonly bm25Weight: number;

  constructor(
    vectorIndex: VectorStoreIndex,
    config: HybridRetrieverConfig = {},
  ) {
    this.vectorIndex = vectorIndex;
    this.topK = config.topK ?? 20;
    this.rrfK = config.rrfK ?? 60;
    this.vectorWeight = config.vectorWeight ?? 0.6;
    this.bm25Weight = config.bm25Weight ?? 0.4;
    
    // Initialize BM25
    this.bm25Retriever = new BM25Retriever(1.5, 0.75);
    
    this.logger.log(
      `HybridRetriever initialized: topK=${this.topK}, rrfK=${this.rrfK}, ` +
      `weights={vector:${this.vectorWeight}, bm25:${this.bm25Weight}}`
    );
  }

  /**
   * Initialize BM25 index with documents.
   */
  initBM25(documents: IndexedDocument[]): void {
    this.bm25Retriever.init(documents);
    this.logger.log(`BM25 index initialized with ${documents.length} documents`);
  }

  /**
   * Add a document to BM25 index.
   */
  addToBM25(doc: IndexedDocument): void {
    this.bm25Retriever.addDocument(doc);
  }

  /**
   * Main retrieval method - combines BM25 and Vector search with RRF.
   */
  async retrieve(query: string, topK?: number): Promise<NodeWithScore[]> {
    const limit = topK ?? this.topK;
    const startTime = Date.now();

    this.logger.debug(`Hybrid retrieval for: "${query.substring(0, 50)}..."`);

    // Run both retrievers in parallel
    const [vectorNodes, bm25Nodes] = await Promise.all([
      this.vectorRetrieve(query, limit * 2),
      this.bm25Retrieve(query, limit * 2),
    ]);

    this.logger.debug(
      `Candidates: vector=${vectorNodes.length}, bm25=${bm25Nodes.length}`
    );

    // Apply weighted RRF fusion
    const fusedResults = this.weightedRRFFusion(vectorNodes, bm25Nodes, limit);

    const elapsed = Date.now() - startTime;
    this.logger.log(
      `Hybrid retrieval: ${fusedResults.length} results in ${elapsed}ms`
    );

    return fusedResults;
  }

  /**
   * Vector similarity search.
   */
  private async vectorRetrieve(
    query: string,
    topK: number,
  ): Promise<NodeWithScore[]> {
    try {
      const retriever = this.vectorIndex.asRetriever({
        similarityTopK: topK,
      });
      
      const nodes = await retriever.retrieve({ query } as any);
      
      return nodes.map((node: any) => ({
        node: {
          id_: node.node?.id_,
          metadata: node.node?.metadata,
          getContent: (mode?: any) => node.node?.getContent?.(mode) || node.node?.text || '',
          text: node.node?.text || '',
        },
        score: node.score,
      }));
    } catch (error: any) {
      this.logger.error(`Vector retrieval failed: ${error.message}`);
      return [];
    }
  }

  /**
   * BM25 keyword search.
   */
  private async bm25Retrieve(
    query: string,
    topK: number,
  ): Promise<NodeWithScore[]> {
    try {
      return await this.bm25Retriever.retrieve(query, topK);
    } catch (error: any) {
      this.logger.error(`BM25 retrieval failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Weighted Reciprocal Rank Fusion
   */
  private weightedRRFFusion(
    vectorResults: NodeWithScore[],
    bm25Results: NodeWithScore[],
    limit: number,
  ): NodeWithScore[] {
    const scoreMap = new Map<string, FusedNode>();

    // Process vector results with weight
    vectorResults.forEach((node, rank) => {
      const key = this.getNodeKey(node);
      const rrfScore = this.vectorWeight / (this.rrfK + rank + 1);
      
      scoreMap.set(key, {
        node,
        rrfScore,
        sources: ['vector'],
      });
    });

    // Process BM25 results with weight
    bm25Results.forEach((node, rank) => {
      const key = this.getNodeKey(node);
      const rrfScore = this.bm25Weight / (this.rrfK + rank + 1);

      if (scoreMap.has(key)) {
        const existing = scoreMap.get(key)!;
        existing.rrfScore += rrfScore;
        existing.sources.push('bm25');
      } else {
        scoreMap.set(key, {
          node,
          rrfScore,
          sources: ['bm25'],
        });
      }
    });

    // Sort by fused score and take top K
    const sorted = [...scoreMap.values()]
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, limit);

    return sorted.map(item => ({
      node: item.node.node,
      score: item.rrfScore,
      metadata: {
        ...item.node.node?.metadata,
        retrievalSources: item.sources,
      },
    }));
  }

  /**
   * Generate unique key for a node.
   */
  private getNodeKey(node: NodeWithScore): string {
    const nodeId = node.node?.id_;
    if (nodeId) return nodeId;
    
    const content = node.node?.getContent?.(MetadataMode.NONE) || node.node?.text || '';
    return this.hashString(content);
  }

  /**
   * Simple string hash.
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Hybrid retrieval debug info.
   */
  getDebugInfo(): { bm25DocCount: number; bm25TermCount: number; vectorIndexExists: boolean } {
    const bm25Stats = this.bm25Retriever.getStats();
    return {
      bm25DocCount: bm25Stats.docCount,
      bm25TermCount: bm25Stats.termCount,
      vectorIndexExists: !!this.vectorIndex,
    };
  }
}

/**
 * Fused node for RRF fusion.
 */
interface FusedNode {
  node: NodeWithScore;
  rrfScore: number;
  sources: string[];
}

/**
 * BM25Retriever index statistics.
 */
export interface BM25Stats {
  docCount: number;
  termCount: number;
  avgDocLength: number;
}
