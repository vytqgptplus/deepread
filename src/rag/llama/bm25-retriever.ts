/**
 * BM25 Retriever - Production-grade keyword-based retrieval
 * 
 * Implements Okapi BM25 algorithm for production-quality keyword search.
 * BM25 is the gold standard for keyword retrieval in search engines.
 * 
 * Reference: Robertson & Zaragoza (2009) "The Probabilistic Relevance Framework: BM25 and Beyond"
 */

import { Logger } from '@nestjs/common';

export interface IndexedDocument {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
  tokenizedText?: string[];
}

/**
 * NodeWithScore for compatibility with LlamaIndex types.
 */
export interface NodeWithScore {
  node: {
    id_?: string;
    metadata?: Record<string, unknown>;
    getContent: (mode?: any) => string;
    [key: string]: any;
  };
  score?: number;
}

/**
 * BM25 Retriever - Production-grade BM25 implementation
 * 
 * Implements the Okapi BM25 ranking function:
 * Score(D, Q) = Σ IDF(qi) * (tf(t, D) * (k1 + 1)) / (tf(t, D) + k1 * (1 - b + b * |D|/avgdl))
 * 
 * Features:
 * - Configurable k1, b parameters
 * - Proper IDF calculation with smoothing
 * - Document length normalization
 * - Incremental indexing
 */
export class BM25Retriever {
  private readonly logger = new Logger(BM25Retriever.name);
  
  // BM25 parameters
  private readonly k1: number;
  private readonly b: number;
  private readonly epsilon: number;
  
  // Index data structures
  private documents: IndexedDocument[] = [];
  private invertedIndex: Map<string, PostingList> = new Map();
  private avgDocLength = 0;
  private docCount = 0;
  private idfCache: Map<string, number> = new Map();

  constructor(k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.epsilon = 0.25;
    
    this.logger.log(`BM25Retriever initialized with k1=${this.k1}, b=${this.b}`);
  }

  /**
   * Initialize index with documents.
   */
  init(documents: IndexedDocument[]): void {
    this.documents = documents;
    this.docCount = documents.length;
    this.buildIndex();
  }

  /**
   * Build inverted index and compute statistics.
   */
  private buildIndex(): void {
    this.invertedIndex.clear();
    this.idfCache.clear();
    
    let totalLength = 0;

    for (const doc of this.documents) {
      const tokenized = doc.tokenizedText || this.tokenize(doc.text);
      totalLength += tokenized.length;

      // Build inverted index
      const termFrequency = new Map<string, number>();
      for (const term of tokenized) {
        termFrequency.set(term, (termFrequency.get(term) || 0) + 1);
      }

      for (const [term, tf] of termFrequency) {
        let posting = this.invertedIndex.get(term);
        if (!posting) {
          posting = { term, documents: [], docFreq: 0 };
          this.invertedIndex.set(term, posting);
        }
        
        posting.documents.push({
          docId: doc.id,
          tf,
          positions: [],
        });
        posting.docFreq++;
      }
    }

    // Compute average document length
    this.avgDocLength = totalLength / Math.max(this.docCount, 1);
    
    // Precompute IDF for all terms
    for (const [term, posting] of this.invertedIndex) {
      this.idfCache.set(term, this.computeIDF(posting.docFreq));
    }
    
    this.logger.log(
      `BM25 index built: ${this.docCount} docs, ${this.invertedIndex.size} unique terms`
    );
  }

  /**
   * Tokenize text into terms.
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s\p{P}]+/u)
      .filter(term => term.length > 1)
      .map(term => term.replace(/[^\w\s]/gu, ''))
      .filter(term => term.length > 1);
  }

  /**
   * Compute IDF for a term.
   */
  private computeIDF(docFreq: number): number {
    const n = docFreq;
    const N = this.docCount;
    
    return Math.log(((N - n + 0.5) / (n + 0.5)) + 1);
  }

  /**
   * Calculate BM25 score for a document against a query.
   */
  private scoreDocument(doc: IndexedDocument, queryTerms: string[]): number {
    let score = 0;
    const tokenized = doc.tokenizedText || this.tokenize(doc.text);
    const docLength = tokenized.length;

    for (const queryTerm of queryTerms) {
      const posting = this.invertedIndex.get(queryTerm);
      if (!posting) continue;

      const docPosting = posting.documents.find(p => p.docId === doc.id);
      if (!docPosting) continue;

      const tf = docPosting.tf;
      const idf = this.idfCache.get(queryTerm) || 0;

      const numerator = tf * (this.k1 + 1);
      const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / this.avgDocLength));
      
      score += idf * (numerator / denominator);
    }

    return score;
  }

  /**
   * Retrieve relevant documents for a query.
   */
  async retrieve(query: string, topK = 10): Promise<NodeWithScore[]> {
    const queryTerms = this.tokenize(query);
    
    this.logger.debug(`BM25 query: "${query}" (${queryTerms.length} terms)`);

    if (queryTerms.length === 0) {
      return [];
    }

    // Score all documents
    const scores: { doc: IndexedDocument; score: number }[] = [];
    
    for (const doc of this.documents) {
      const score = this.scoreDocument(doc, queryTerms);
      if (score > 0) {
        scores.push({ doc, score });
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Return top K as NodeWithScore
    const maxScore = scores[0]?.score || 1;
    const results: NodeWithScore[] = scores.slice(0, topK).map(({ doc, score }) => ({
      node: {
        id_: doc.id,
        metadata: doc.metadata || {},
        getContent: () => doc.text,
        text: doc.text,
      },
      score: this.normalizeScore(score, maxScore),
    }));

    this.logger.debug(`BM25 retrieved ${results.length} results`);
    
    return results;
  }

  /**
   * Normalize score to 0-1 range.
   */
  private normalizeScore(score: number, maxScore: number): number {
    if (maxScore === 0) return 0;
    return Math.min(1, score / maxScore);
  }

  /**
   * Add a document to the index.
   */
  addDocument(doc: IndexedDocument): void {
    if (!doc.text || doc.text.trim().length === 0) {
      this.logger.warn(`Skipping empty document: ${doc.id}`);
      return;
    }
    
    this.documents.push(doc);
    this.docCount++;
    
    const tokenized = doc.tokenizedText || this.tokenize(doc.text);
    const termFrequency = new Map<string, number>();
    
    for (const term of tokenized) {
      termFrequency.set(term, (termFrequency.get(term) || 0) + 1);
    }

    for (const [term, tf] of termFrequency) {
      let posting = this.invertedIndex.get(term);
      if (!posting) {
        posting = { term, documents: [], docFreq: 0 };
        this.invertedIndex.set(term, posting);
      }
      
      posting.documents.push({
        docId: doc.id,
        tf,
        positions: [],
      });
      posting.docFreq++;
      
      this.idfCache.set(term, this.computeIDF(posting.docFreq));
    }
    
    this.avgDocLength = (
      (this.avgDocLength * (this.docCount - 1)) + tokenized.length
    ) / this.docCount;
  }

  /**
   * Clear the index.
   */
  clear(): void {
    this.documents = [];
    this.invertedIndex.clear();
    this.idfCache.clear();
    this.avgDocLength = 0;
    this.docCount = 0;
  }

  /**
   * Get index statistics.
   */
  getStats(): { docCount: number; termCount: number; avgDocLength: number } {
    return {
      docCount: this.docCount,
      termCount: this.invertedIndex.size,
      avgDocLength: this.avgDocLength,
    };
  }

  /**
   * Get all documents for debugging.
   */
  getDocuments(): IndexedDocument[] {
    return [...this.documents];
  }
}

interface PostingList {
  term: string;
  documents: Posting[];
  docFreq: number;
}

interface Posting {
  docId: string;
  tf: number;
  positions: number[];
}
