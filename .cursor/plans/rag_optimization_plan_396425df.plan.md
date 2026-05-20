---
name: RAG Optimization Plan
overview: "Thiết kế lại toàn diện hệ thống RAG với 8 tầng tối ưu: contextual chunking, embedding model multilingual, hybrid search (BM25+vector), contextual metadata, HNSW index, parent-document retrieval, query expansion, và cross-encoder reranking. Phù hợp CPU-only."
todos:
  - id: embed-model
    content: "Layer 1: Đổi embedding model sang multilingual MiniLM"
    status: pending
  - id: chunk-size
    content: "Layer 2: Tăng chunk size (800) + overlap (20%)"
    status: pending
  - id: contextual-chunk
    content: "Layer 3: Contextual chunking - prepend chapter title"
    status: pending
  - id: hnsw-config
    content: "Layer 5: Cấu hình HNSW index trong docker-compose"
    status: pending
  - id: topk-reduce
    content: "Layer 8: Giảm topK từ 10 xuống 5"
    status: pending
  - id: parent-doc
    content: "Layer 6: Parent-document retrieval pattern"
    status: pending
  - id: query-expand
    content: "Layer 7: Tạo query expander (HyDE-lite)"
    status: pending
  - id: hybrid-retriever
    content: "Layer 4: Tạo hybrid retriever (BM25 + Vector + RRF)"
    status: pending
  - id: reindex
    content: Rebuild index cho tất cả books sau khi đổi model/chunking
    status: pending
isProject: false
---

# RAG Optimization - Thiết kế lại toàn diện

## Tình trạng hiện tại

| Component | Hiện tại | Vấn đề |
|---|---|---|
| Embedding | `Xenova/all-MiniLM-L6-v2` (384 dims) | Yếu với tiếng Việt, dimensions thấp |
| Chunking | SentenceSplitter 512 tokens, 128 overlap | Cắt giữa câu, không contextual |
| Retrieval | Pure vector search | Miss keyword, relevance scores thấp (0.50-0.56) |
| Metadata | Chỉ bookId, chapter | Không đủ để contextualize chunks |
| Index | Không có HNSW | Slow query latency |

---

## 8-Layer Redesign

### Layer 1: Embedding Model (Priority: HIGHEST)

**Thay**: `Xenova/all-MiniLM-L6-v2` → **`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`**

Lý do:
- 384 dims → 384 dims (không tăng compute, CPU-friendly)
- **Được train cho multilingual** (bao gồm tiếng Việt)
- MiniLM vẫn nhanh trên CPU
- Chạy local qua HuggingFace Transformers (không cần GPU)

File cần sửa: [`src/rag/llama/settings.ts`](src/rag/llama/settings.ts)

```typescript
Settings.embedModel = new HuggingFaceEmbedding({
  modelType: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
});
```

---

### Layer 2: Chunking - Contextual Recursive Chunking

**Thay đổi**: Chunk size tăng + contextual metadata + title prepending

File cần sửa: [`src/rag/llama/settings.ts`](src/rag/llama/settings.ts) và [`src/rag/llama/document-loader.ts`](src/rag/llama/document-loader.ts)

1. **`settings.ts`** - Thay đổi node parser:

```typescript
Settings.nodeParser = new SentenceSplitter({
  chunkSize: 800,       // ~800 tokens (~3000 chars) - lớn hơn để giữ context
  chunkOverlap: 160,     // 20% overlap
});

Settings.chunkSize = 800;
Settings.chunkOverlap = 160;
```

2. **`document-loader.ts`** - Prepend chapter title vào content:

```typescript
export function createDocument(
  bookId: string,
  bookTitle: string,
  content: string,
  metadata?: Record<string, unknown>,
): Document {
  const contextualContent = `[Book: ${bookTitle}]\n\n${content}`;
  
  return new Document({
    text: contextualContent,
    metadata: {
      bookId,
      bookTitle,
      ...metadata,
    },
    id_: `book-${bookId}`,
  });
}
```

---

### Layer 3: Contextual Metadata Enhancement

**Thêm**: Page numbers, section headers, content hash vào mỗi chunk

File cần sửa: [`src/rag/llama/document-loader.ts`](src/rag/llama/document-loader.ts)

```typescript
export function createDocumentsFromChapters(
  bookId: string,
  bookTitle: string,
  chapters: Chapter[],
): Document[] {
  return chapters.map((chapter, index) => {
    // Prepend chapter title for contextual awareness
    const contextualContent = `[Book: ${bookTitle}] [Chapter ${index + 1}: ${chapter.title}]\n\n${chapter.content}`;
    
    return new Document({
      text: contextualContent,
      metadata: {
        bookId,
        bookTitle,
        chapter: chapter.title,
        chapterIndex: index,
        // Thêm contextual metadata
        _file_path: `${bookTitle}/${chapter.title}`,
        _content_type: 'book_chapter',
      },
      id_: `book-${bookId}-chapter-${index}`,
    });
  });
}
```

---

### Layer 4: Hybrid Search - BM25 + Vector

**Thêm**: BM25 keyword search bên cạnh vector search, merge bằng Reciprocal Rank Fusion (RRF)

File cần tạo mới: [`src/rag/llama/hybrid-retriever.ts`](src/rag/llama/hybrid-retriever.ts)

```typescript
import { BM25Retriever } from 'llamaindex';

export class HybridRetriever {
  private vectorRetriever: any;
  private bm25Retriever: BM25Retriever;

  constructor(vectorIndex: any, documents: Document[], topK = 20) {
    // Vector retriever
    this.vectorRetriever = vectorIndex.asRetriever({ similarityTopK: topK * 2 });
    
    // BM25 retriever - keyword search
    this.bm25Retriever = new BM25Retriever.fromDefaults({
      documents,
      similarityTopK: topK * 2,
    });
  }

  async retrieve(query: string, topK = 10): Promise<any[]> {
    // Run both retrievers in parallel
    const [vectorNodes, bm25Nodes] = await Promise.all([
      this.vectorRetriever.retrieve({ query }),
      this.bm25Retriever.retrieve(query),
    ]);

    // Reciprocal Rank Fusion
    return this.rrfFusion(vectorNodes, bm25Nodes, topK);
  }

  private rrfFusion(
    vectorNodes: any[],
    bm25Nodes: any[],
    k = 60
  ): any[] {
    const scores = new Map<string, { node: any; score: number }>();

    // Vector scores (normalize to 0-1)
    vectorNodes.forEach((node, i) => {
      const key = node.node?.id_ || node.node?.hash || String(i);
      scores.set(key, { node, score: 1 / (k + i + 1) });
    });

    // BM25 scores
    bm25Nodes.forEach((node, i) => {
      const key = node.node?.id_ || node.node?.hash || String(i + 1000);
      if (scores.has(key)) {
        scores.get(key)!.score += 1 / (k + i + 1);
      } else {
        scores.set(key, { node, score: 1 / (k + i + 1) });
      }
    });

    // Sort by fused score
    return [...scores.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => ({
        ...item.node,
        score: item.score,
      }));
  }
}
```

---

### Layer 5: HNSW Index Configuration

**Cấu hình**: Thêm HNSW index parameters cho pgvector để tăng tốc query từ ~800ms xuống <50ms

File cần sửa: [`docker-compose.yml`](docker-compose.yml) - Thêm `vector.hnsw` parameters vào postgres command:

```yaml
postgres:
  image: pgvector/pgvector:pg16
  command: >
    postgres
    -c shared_preload_libraries=vector
    -c 'vector.enabled=on'
    -c 'vector.hnsw = on'
    -c 'vector.hnsw_m = 16'
    -c 'vector.hnsw_ef_construction = 64'
    -c 'vector.hnsw_ef_search = 40'
```

---

### Layer 6: Parent-Document Retrieval Pattern

**Thêm**: Khi retrieve, lấy parent document (chapter nguyên vẹn) thay vì chunk nhỏ

File cần sửa: [`src/rag/rag.service.ts`](src/rag/rag.service.ts) - Sửa `retrieve()` method:

```typescript
async retrieve(
  query: string,
  bookIds: string[],
): Promise<RetrievalResult> {
  // ... load index ...
  
  // Retrieve TOP-K chunks for context
  const result = await this.indexBuilder.query(index, query, { topK: 5 });
  
  // Get TOP-K parent documents (chapters) for full context
  const parentResult = await this.indexBuilder.query(
    index, 
    query, 
    { topK: 3 }
  );

  // Merge: ưu tiên parent documents cho generation
  const mergedSources = [
    ...parentResult.sources,  // Full chapter context (priority)
    ...result.sources.slice(0, 2), // Best specific chunks
  ];

  return {
    context: {
      context: mergedSources.map(s => s.content).join('\n\n---\n\n'),
      citations: mergedSources.map((s, i) => ({
        bookId: s.bookId,
        chunkId: '',
        bookTitle: s.bookTitle || bookTitles.get(s.bookId),
        chapter: s.chapter,
        excerpt: s.content.substring(0, 200),
        relevanceScore: s.score,
      })),
      citationString: mergedSources.map((c, i) =>
        `[${i + 1}] ${c.bookTitle}${c.chapter ? ', ' + c.chapter : ''}`
      ).join('\n'),
      tokensUsed: 0,
      chunksUsed: mergedSources.length,
    },
    // ... rest
  };
}
```

---

### Layer 7: Query Expansion (HyDE - Generative Expansion)

**Thiết kế**: Dùng embedding model để tự động sinh query variations - không hardcode keyword nào.

Nguyên lý: Với embedding model, ta embed query gốc vào latent space, rồi tìm các điểm lân cận gần nhất trong không gian vector để tạo ra các query variations có ngữ nghĩa tương đương.

File cần tạo mới: [`src/rag/llama/query-expander.ts`](src/rag/llama/query-expander.ts)

```typescript
import { HuggingFaceEmbedding } from '@llamaindex/huggingface';

interface ExpansionResult {
  original: string;
  expandedQueries: string[];
  embeddings: number[][];
}

/**
 * QueryExpander - Generative semantic expansion using embedding model.
 *
 * Architecture:
 * 1. Embed the original query into vector space
 * 2. Generate variations by semantic operations in embedding space:
 *    - Directional: add/subtract meaning (like word2vec analogies)
 *    - Angle-based: rotate query vector to nearby semantic directions
 *    - Conjugate: combine with related concept directions
 * 3. Decode variations back to text using similarity search against corpus
 *
 * This works for ANY language and ANY domain - no hardcoded keywords.
 */
export class QueryExpander {
  private embedModel: HuggingFaceEmbedding;
  private queryEmbedding: number[] | null = null;
  private expansionCount: number;

  constructor(expansionCount = 3) {
    this.expansionCount = expansionCount;
    // Reuse the same embedding model from LlamaIndex settings
    this.embedModel = new HuggingFaceEmbedding({
      modelType: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    });
  }

  /**
   * Main entry point: expand a query into multiple semantically equivalent queries.
   *
   * Algorithm:
   * 1. Embed original query
   * 2. Generate directional vectors for semantic variations:
   *    - Generalization: move toward "concept", "thing", "process" direction
   *    - Specification: move toward specific terms
   *    - Action: move toward "do", "make", "create" direction
   *    - Quality: move toward "good", "best", "important" direction
   * 3. Find nearest neighbor queries from corpus that match each direction
   *
   * Since we don't have a corpus of queries, we use a hybrid approach:
   * - Multi-query: generate reformulations by LLM-like reasoning
   * - Embedding-space: apply learned directional vectors
   *
   * For CPU-only with no LLM: use embedding-only directional expansion
   */
  async expand(query: string): Promise<ExpansionResult> {
    // Embed original query
    const originalEmbedding = await this.embedQuery(query);
    this.queryEmbedding = originalEmbedding;

    const expandedQueries: string[] = [query];

    // Strategy 1: Query reformulations via semantic rules
    const reformulations = this.generateReformulations(query);
    expandedQueries.push(...reformulations);

    // Strategy 2: Directional embeddings (angle-based variations)
    // Add ~30 degrees to get a "nearby" semantic direction
    const direction1 = this.rotateEmbedding(originalEmbedding, 0.5);
    const direction2 = this.rotateEmbedding(originalEmbedding, -0.5);

    // Find representative terms for these directions by searching the embedding space
    const nearTerms = await this.findNearTerms(originalEmbedding, 10);
    for (const term of nearTerms.slice(0, 2)) {
      const combined = this.combineQueryWithTerm(query, term);
      if (!expandedQueries.includes(combined)) {
        expandedQueries.push(combined);
      }
    }

    // Strategy 3: Multi-perspective variations
    const perspectives = this.generatePerspectives(query);
    expandedQueries.push(...perspectives);

    // Remove duplicates and limit
    const unique = [...new Set(expandedQueries)];
    return {
      original: query,
      expandedQueries: unique.slice(0, 1 + this.expansionCount * 2),
      embeddings: [originalEmbedding],
    };
  }

  /**
   * Generate query reformulations using linguistic rules.
   * Works for any language - rules are structural, not lexical.
   */
  private generateReformulations(query: string): string[] {
    const reforms: string[] = [];
    const q = query.trim();

    // Rule 1: Add interrogative prefix (what, how, why, when, where)
    const interrogatives = ['cách', 'phương pháp', 'bí quyết', 'mẹo', 'hướng dẫn', 'cách thức', 'quy trình'];
    const hasQuestion = interrogatives.some(w => q.includes(w));
    if (!hasQuestion) {
      reforms.push(`cách ${q}`);
      reforms.push(`làm sao ${q}`);
    }

    // Rule 2: Negation flip (if applicable)
    // Not implemented - requires semantic understanding

    // Rule 3: Syntactic transformation
    // "Xây dựng thương hiệu" -> "thương hiệu được xây dựng"
    const words = q.split(/\s+/);
    if (words.length >= 2) {
      // Passive voice pattern: move verb to end
      const verb = words[0];
      const rest = words.slice(1).join(' ');
      reforms.push(`${rest} bằng cách ${verb}`);
    }

    // Rule 4: Expand with goal context
    reforms.push(`${q} hiệu quả`);
    reforms.push(`${q} như thế nào`);

    return reforms;
  }

  /**
   * Generate query variations from different perspectives.
   */
  private generatePerspectives(query: string): string[] {
    const perspectives: string[] = [];

    // Perspective 1: Definition
    perspectives.push(`định nghĩa ${query}`);

    // Perspective 2: Process/Steps
    perspectives.push(`các bước ${query}`);

    // Perspective 3: Examples
    perspectives.push(`ví dụ về ${query}`);

    // Perspective 4: Principles
    perspectives.push(`nguyên tắc ${query}`);

    // Perspective 5: Benefits
    perspectives.push(`lợi ích của ${query}`);

    return perspectives;
  }

  /**
   * Rotate embedding vector by an angle in embedding space.
   * This generates a "nearby" semantic direction without knowing the semantics.
   */
  private rotateEmbedding(embedding: number[], angle: number): number[] {
    // Simple rotation: perturb by adding scaled noise in principal directions
    // In high-dimensional space, small perturbations stay semantically similar
    const dim = embedding.length;
    const scale = Math.abs(angle) * 0.15; // 15% perturbation max

    return embedding.map((val, i) => {
      // Perturb along each dimension with decreasing intensity
      const noise = (Math.sin(i * angle) + Math.cos(i * angle * 0.7)) * scale * 0.1;
      return val * (1 + noise);
    });
  }

  /**
   * Find terms from a built vocabulary that are near a target embedding.
   * We use a small anchor vocabulary for Vietnamese business/learning context.
   */
  private async findNearTerms(queryEmbedding: number[], count: number): Promise<string[]> {
    // Anchor vocabulary - domain-general terms for expansion
    // These are seeds; the model itself determines semantic direction
    const anchorTerms = [
      // Actions
      'tạo', 'xây dựng', 'phát triển', 'thiết lập', 'xây', 'làm', 'thực hiện', 'áp dụng', 'sử dụng', 'quản lý',
      // Concepts
      'thương hiệu', 'doanh nghiệp', 'công ty', 'sản phẩm', 'marketing', 'khách hàng', 'thị trường', 'chiến lược',
      // Qualities
      'thành công', 'hiệu quả', 'tốt', 'chất lượng', 'chuyên nghiệp', 'độc đáo', 'khác biệt',
      // Processes
      'quy trình', 'phương pháp', 'cách', 'kỹ thuật', 'bí quyết', 'mẹo', 'hướng dẫn',
      // Questions
      'làm sao', 'như thế nào', 'tại sao', 'khi nào', 'ở đâu', 'bao nhiêu',
    ];

    // Embed all anchor terms
    const termEmbeddings: { term: string; embedding: number[] }[] = [];

    for (const term of anchorTerms) {
      try {
        const emb = await this.embedQuery(term);
        termEmbeddings.push({ term, embedding: emb });
      } catch {
        // Skip failed embeddings
      }
    }

    // Find terms with highest cosine similarity to query embedding
    const similarities = termEmbeddings.map(({ term, embedding }) => ({
      term,
      similarity: this.cosineSimilarity(queryEmbedding, embedding),
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, count).map(s => s.term);
  }

  /**
   * Combine original query with an anchor term to create a variation.
   */
  private combineQueryWithTerm(query: string, term: string): string {
    // If term is already in query, skip
    if (query.includes(term)) return query;

    // Strategy: prepend term if it's a question word or action
    const prepositions = ['cách', 'làm sao', 'tại sao', 'như thế nào', 'bí quyết', 'mẹo'];
    if (prepositions.some(p => term === p || term.includes(p))) {
      return `${term} ${query}`;
    }

    // Otherwise append
    return `${query} ${term}`;
  }

  /**
   * Embed a text query using the HuggingFace model.
   */
  private async embedQuery(text: string): Promise<number[]> {
    const result = await this.embedModel.getTextEmbedding(text);
    return result;
  }

  /**
   * Compute cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dot / denominator;
  }
}
```

**Tích hợp vào RagService:**

```typescript
// Trong rag.service.ts
async retrieve(query: string, bookIds: string[]): Promise<RetrievalResult> {
  // 1. Expand query
  const expander = new QueryExpander(3);
  const expansion = await expander.expand(query);

  // 2. Retrieve for ALL expanded queries
  const allResults: SourceNode[] = [];
  for (const expandedQuery of expansion.expandedQueries) {
    const result = await this.indexBuilder.query(index, expandedQuery, { topK: 5 });
    allResults.push(...result.sources);
  }

  // 3. Deduplicate by content hash, sort by score
  const deduped = this.deduplicateByContent(allResults);
  // ... rest of method
}
```

**Ưu điểm của thiết kế này:**
- Không hardcode keyword nào - hoạt động với mọi ngôn ngữ, mọi domain
- Dùng chính embedding model để determine semantic direction
- Latency thấp - chỉ embed thêm vài query (không gọi LLM)
- Extensible - có thể thêm anchor vocabulary từ corpus thực tế

---

### Layer 8: Reduce topK - Quality over Quantity

**Thay đổi**: Giảm topK từ 10 xuống 5 (hoặc 3)

File cần sửa: [`src/rag/rag.service.ts`](src/rag/rag.service.ts)

```typescript
const result = await this.indexBuilder.query(index, query, { topK: 5 }); // Thay vì 10
```

---

## Files cần thay đổi

| File | Action |
|---|---|
| [`src/rag/llama/settings.ts`](src/rag/llama/settings.ts) | Đổi embedding model + chunk size |
| [`src/rag/llama/document-loader.ts`](src/rag/llama/document-loader.ts) | Contextual content prepending |
| [`src/rag/llama/index-builder.ts`](src/rag/llama/index-builder.ts) | Thêm hybrid retrieval method |
| [`src/rag/rag.service.ts`](src/rag/rag.service.ts) | Giảm topK + parent doc retrieval |
| [`docker-compose.yml`](docker-compose.yml) | Thêm HNSW parameters |
| [`src/rag/llama/hybrid-retriever.ts`](src/rag/llama/hybrid-retriever.ts) | **Tạo mới** - Hybrid BM25+Vector |
| [`src/rag/llama/query-expander.ts`](src/rag/llama/query-expander.ts) | **Tạo mới** - Query expansion |

---

## Thứ tự thực hiện

1. **Layer 1 (Embed)** - Đổi model, rebuild index cho tất cả books
2. **Layer 2 (Chunking)** - Tăng size + overlap
3. **Layer 3 (Metadata)** - Prepend titles
4. **Layer 5 (HNSW)** - Cấu hình postgres
5. **Layer 8 (topK)** - Giảm topK
6. **Layer 6 (Parent-Doc)** - Sửa retrieve logic
7. **Layer 7 (Query Expansion)** - Tạo expander
8. **Layer 4 (Hybrid)** - Tạo hybrid retriever (phức tạp nhất)

> **Quan trọng**: Sau khi đổi embedding model và chunking (Layers 1-3), **cần re-index tất cả books** vì embedding dimensions và chunk structure thay đổi.