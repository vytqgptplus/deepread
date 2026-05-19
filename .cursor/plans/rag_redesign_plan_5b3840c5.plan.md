# RAG Redesign Plan — DeepRead (LlamaIndex.TS)

## 1. Phân tích vấn đề hiện tại

**Thiết kế hiện tại:**
```
QueryExpansion → VectorSearch (hash TF-IDF) → KeywordSearch → Reranker → ContextAssembly
```

**Vấn đề chính:**
- `VectorSearchService` dùng **hash-based TF-IDF** — không phải semantic embedding
- Layer 1 Query Expansion over-engineered
- Chunking cứng nhắc (1000 chars)
- Không có metadata enrichment cho chunks
- 5 file layers/ quá phức tạp

---

## 2. Thiết kế mới — LlamaIndex.TS Pattern

### 2.1. Kiến trúc với LlamaIndex.TS

```
┌─────────────────────────────────────────────────────────────┐
│              INGESTION (LlamaIndex Pipeline)                  │
│                                                              │
│  Book Content (text)                                         │
│       ↓                                                       │
│  Document  ──→  SimpleNodeParser  ──→  VectorStoreIndex     │
│  (metadata)    (SentenceSplitter)      (PGVectorStore)       │
│                      ↓                                        │
│                EmbeddingModel                                 │
│              (OpenAI / Local)                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              QUERY (LlamaIndex QueryEngine)                  │
│                                                              │
│  User Question                                               │
│       ↓                                                       │
│  QueryEngine ──→ VectorStoreRetriever ──→ ResponseSynthesizer│
│                      ↓                                        │
│                 pgvector (cosine similarity)                  │
│                      ↓                                        │
│              Answer + Source Nodes                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2. Tại sao dùng LlamaIndex.TS?

- **VectorStoreIndex** — Index documents, tự động chunk và embed
- **SimpleNodeParser / SentenceSplitter** — Chunking thông minh, giữ nguyên sentence boundaries
- **PGVectorStore** — Tích hợp pgvector native, không cần custom SQL
- **QueryEngine** — Tự động retrieval + synthesis, hỗ trợ streaming
- **ChatEngine** — Multi-turn conversation với memory
- **StorageContext** — Persistence, đồng bộ với PostgreSQL

### 2.3. So sánh Before vs After

| Khía cạnh | Before | After (LlamaIndex.TS) |
|-----------|--------|------------------------|
| Embedding | Hash-based TF-IDF (fake) | Real semantic (OpenAI/MultiModal) |
| Vector Storage | JSON array | **PGVectorStore (pgvector)** |
| Vector Search | JS cosine (O(n)) | pgvector SQL (O(log n) với index) |
| Chunking | Hardcoded 1000 chars | **SentenceSplitter (token-aware)** |
| Query | Custom retrieval logic | **QueryEngine tự động** |
| Code | 6 files layers/ | **1 service (wrapper)** |
| Streaming | Custom SSE | **Built-in streaming support** |

---

## 3. LlamaIndex.TS Modules sử dụng

### 3.1. Core Components

```typescript
// Document - wrapper cho book content
import { Document } from "llamaindex";

// VectorStoreIndex - index documents
import { VectorStoreIndex } from "llamaindex";

// Node Parser - chunking
import { SimpleNodeParser, SentenceSplitter } from "llamaindex";

// Query Engine - retrieval + synthesis
import { QueryEngine } from "llamaindex";

// Settings - global config
import { Settings } from "llamaindex";
```

### 3.2. Vector Store (pgvector)

```typescript
// PGVectorStore - tích hợp pgvector
import { PGVectorStore } from "@llamaindex/pg";

// Storage Context - persistence
import { storageContextFromDefaults } from "llamaindex";
```

### 3.3. Embedding Models

```typescript
// OpenAI Embeddings (default)
import { OpenAIEmbedding } from "@llamaindex/openai";

// Local Embeddings (transformers.js)
import { HuggingFaceEmbedding } from "@llamaindex/huggingface";
```

---

## 4. Chi tiết triển khai

### 4.1. Package cần cài

```bash
pnpm add llamaindex @llamaindex/pg pg
```

### 4.2. Cấu trúc file mới

```
src/rag/
├── rag.module.ts                      # Updated
├── rag.service.ts                     # Simplified (delegate to LlamaIndex)
├── llama/
│   ├── index.ts                      # NEW: LlamaIndex setup & exports
│   ├── document-loader.ts             # NEW: Book → Document conversion
│   ├── index-builder.ts               # NEW: Build & manage index
│   └── query-engine.ts                # NEW: Query wrapper
└── layers/                            # DELETE (old Layer 1-3)
```

### 4.3. LlamaIndex Setup

```typescript
// src/rag/llama/index.ts
import { Settings } from "llamaindex";
import { OpenAIEmbedding } from "@llamaindex/openai";
import { PGVectorStore } from "@llamaindex/pg";
import { SimpleNodeParser } from "llamaindex";

// Configure embedding model
Settings.embedModel = new OpenAIEmbedding({
  model: "text-embedding-3-small", // or text-embedding-3-large for better quality
});

// Configure node parser for semantic chunking
Settings.nodeParser = new SimpleNodeParser({
  textSplitter: new SentenceSplitter({
    chunkSize: 512,     // tokens
    chunkOverlap: 128,  // tokens
  }),
});

// Configure LLM (optional, for synthesis)
Settings.llm = openai({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-mini",
});
```

### 4.4. Document Loader

```typescript
// src/rag/llama/document-loader.ts
import { Document } from "llamaindex";

/**
 * Convert book content to LlamaIndex Document.
 * Document is the atomic unit in LlamaIndex - represents a chunk of text.
 */
export function createDocument(
  bookId: string,
  bookTitle: string,
  content: string,
  metadata?: Record<string, unknown>
): Document {
  return new Document({
    text: content,
    metadata: {
      bookId,
      bookTitle,
      ...metadata,
    },
    id_: `book-${bookId}`,
  });
}

/**
 * Create multiple documents from chapters.
 */
export function createDocumentsFromChapters(
  bookId: string,
  bookTitle: string,
  chapters: Array<{ title: string; content: string }>
): Document[] {
  return chapters.map((chapter, index) =>
    new Document({
      text: chapter.content,
      metadata: {
        bookId,
        bookTitle,
        chapter: chapter.title,
        chapterIndex: index,
      },
      id_: `book-${bookId}-chapter-${index}`,
    })
  );
}
```

### 4.5. Index Builder

```typescript
// src/rag/llama/index-builder.ts
import {
  VectorStoreIndex,
  PGVectorStore,
  storageContextFromDefaults,
  Document,
} from "llamaindex";

export class LlamaIndexBuilder {
  private vectorStore: PGVectorStore;
  private storageContext: Awaited<ReturnType<typeof storageContextFromDefaults>>;

  constructor(
    private host: string,
    private port: number,
    private database: string,
    private user: string,
    private password: string,
  ) {
    this.vectorStore = new PGVectorStore({
      host,
      port,
      database,
      user,
      password,
    });
  }

  async initialize(): Promise<void> {
    this.storageContext = await storageContextFromDefaults({
      vectorStore: this.vectorStore,
    });
  }

  /**
   * Build index from documents.
   * LlamaIndex handles: chunking → embedding → storing in pgvector
   */
  async buildIndex(documents: Document[]): Promise<VectorStoreIndex> {
    return await VectorStoreIndex.fromDocuments(documents, {
      storageContext: this.storageContext,
      logProgress: true,
    });
  }

  /**
   * Load existing index from vector store.
   */
  async loadIndex(): Promise<VectorStoreIndex> {
    return await VectorStoreIndex.init({
      storageContext: this.storageContext,
    });
  }

  /**
   * Add documents to existing index.
   */
  async addDocuments(
    index: VectorStoreIndex,
    documents: Document[]
  ): Promise<void> {
    await index.insertDocuments(documents, { storageContext: this.storageContext });
  }

  /**
   * Delete documents by bookId.
   */
  async deleteByBookId(index: VectorStoreIndex, bookId: string): Promise<void> {
    await index.deleteRefDoc(`book-${bookId}`);
  }
}
```

### 4.6. Query Engine Wrapper

```typescript
// src/rag/llama/query-engine.ts
import {
  VectorStoreIndex,
  QueryEngine,
  MetadataMode,
  RetrievedNode,
} from "llamaindex";

export interface QueryResult {
  answer: string;
  sources: Array<{
    bookId: string;
    bookTitle: string;
    chapter?: string;
    content: string;
    score: number;
  }>;
}

export class LlamaQueryEngine {
  constructor(private index: VectorStoreIndex) {
    this.index = index;
  }

  /**
   * Query with RAG - retrieve relevant chunks and synthesize answer.
   */
  async query(
    question: string,
    options: { topK?: number; maxTokens?: number } = {}
  ): Promise<QueryResult> {
    const { topK = 10 } = options;

    const queryEngine = this.index.asQueryEngine({
      similarityTopK: topK,
      responseSynthesizer: null, // Use default
    });

    const response = await queryEngine.query({ query: question });

    // Extract sources
    const sources = (response as any).sourceNodes?.map((node: any) => ({
      bookId: node.node.metadata?.bookId || '',
      bookTitle: node.node.metadata?.bookTitle || '',
      chapter: node.node.metadata?.chapter || '',
      content: node.node.getContent(MetadataMode.NONE),
      score: node.score || 0,
    })) || [];

    return {
      answer: response.toString(),
      sources,
    };
  }

  /**
   * Query with streaming response.
   */
  async *streamQuery(
    question: string,
    options: { topK?: number } = {}
  ): AsyncGenerator<string, void, unknown> {
    const { topK = 10 } = options;

    const queryEngine = this.index.asQueryEngine({
      similarityTopK: topK,
    });

    // Get streaming response
    const stream = await queryEngine.query({ query: question });

    for await (const chunk of stream) {
      yield chunk.delta;
    }
  }

  /**
   * Retrieve chunks without synthesis (for debugging/inspection).
   */
  async retrieve(question: string, topK = 10): Promise<RetrievedNode[]> {
    const retriever = this.index.asRetriever({ similarityTopK: topK });
    return await retriever.retrieve({ query: question });
  }
}
```

### 4.7. RagService — Simplified Wrapper

```typescript
// src/rag/rag.service.ts (simplified)
@Injectable()
export class RagService {
  private indexBuilder: LlamaIndexBuilder;
  private indexCache: Map<string, VectorStoreIndex> = new Map();
  private queryEngineCache: Map<string, LlamaQueryEngine> = new Map();

  constructor(private configService: ConfigService) {
    this.indexBuilder = new LlamaIndexBuilder({
      host: configService.get('DB_HOST', 'localhost'),
      port: configService.get('DB_PORT', 5432),
      database: configService.get('DB_NAME', 'deepread'),
      user: configService.get('DB_USER', 'deepread'),
      password: configService.get('DB_PASSWORD', 'deepread_secret'),
    });
  }

  async onModuleInit() {
    await this.indexBuilder.initialize();
  }

  /**
   * Process book: create index in pgvector.
   */
  async processBook(bookId: string, bookTitle: string, content: string): Promise<void> {
    const documents = createDocumentsFromChapters(bookId, bookTitle, this.extractChapters(content));
    const index = await this.indexBuilder.buildIndex(documents);
    this.indexCache.set(bookId, index);
    this.queryEngineCache.set(bookId, new LlamaQueryEngine(index));
  }

  /**
   * Query book(s) with RAG.
   */
  async query(
    question: string,
    bookIds: string[],
    options?: { topK?: number }
  ): Promise<QueryResult> {
    // For simplicity, query first book. Can extend to multi-book.
    const engine = this.queryEngineCache.get(bookIds[0]);
    if (!engine) {
      throw new Error(`Index not found for book: ${bookIds[0]}`);
    }
    return engine.query(question, options);
  }

  /**
   * Delete book index.
   */
  async deleteBook(bookId: string): Promise<void> {
    const index = this.indexCache.get(bookId);
    if (index) {
      await this.indexBuilder.deleteByBookId(index, bookId);
      this.indexCache.delete(bookId);
      this.queryEngineCache.delete(bookId);
    }
  }
}
```

### 4.8. RagModule — Updated

```typescript
// src/rag/rag.module.ts
@Module({
  imports: [],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
```

---

## 5. pgvector Setup

### 5.1. Database Connection (từ docker-compose đã có sẵn)

```typescript
// pgvector connection config
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '9432'), // docker port mapping
  database: process.env.DB_NAME || 'deepread',
  user: process.env.DB_USER || 'deepread',
  password: process.env.DB_PASSWORD || 'deepread_secret',
};
```

### 5.2. pgvector Extension & Index

```sql
-- Đã có trong docker-compose command
-- CREATE EXTENSION IF NOT EXISTS vector;

-- pgvector tự tạo table khi LlamaIndex insert documents
-- Nhưng có thể tạo index manual cho performance:

CREATE INDEX ON document_store
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

---

## 6. Chunking Strategy

### 6.1. Before (hardcoded)

```typescript
// Fixed 1000 chars, no overlap
chunkText(text, 1000, 100); // simplistic
```

### 6.2. After (SentenceSplitter)

```typescript
// Token-aware, preserves sentence boundaries
Settings.nodeParser = new SimpleNodeParser({
  textSplitter: new SentenceSplitter({
    chunkSize: 512,      // ~2000 chars
    chunkOverlap: 128,   // ~500 chars
    separator: ' ',     // split at word boundaries
  }),
});
```

**Tại sao tốt hơn:**
- Không cắt giữa câu
- Giữ context với overlap
- Token-aware (1 token ~= 4 chars)
- Preserve paragraph structure

---

## 7. Embedding Model Options

### 7.1. Local (Selected — Free, Privacy-preserving)

```typescript
import { HuggingFaceEmbedding } from "@llamaindex/huggingface";

Settings.embedModel = HuggingFaceEmbedding.fromDefaults({
  modelName: "Xenova/all-MiniLM-L6-v2", // 384 dims, ~90MB
});
```

**Ưu điểm:**
- Miễn phí, không tốn phí per-token
- Không gửi data ra ngoài
- Model nhẹ (~90MB), inference nhanh (~20ms/embed)
- Tốt cho book-sized data

**Model recommended:**
- `Xenova/all-MiniLM-L6-v2` — 384 dims, fast, good quality
- `Xenova/bge-base-en-v1.5` — 768 dims, better quality, slower

### 7.2. OpenAI (Alternative)

```typescript
import { OpenAIEmbedding } from "@llamaindex/openai";

Settings.embedModel = new OpenAIEmbedding({
  model: "text-embedding-3-small", // 1536 dims, fast, cheap
  // or: "text-embedding-3-large" // 3072 dims, better quality
});
```

---

## 8. Complete Flow Example

**User hỏi:** *"What is the main theme of Chapter 5?"*

```
1. ChatService.createMessage(..., useRag: true)
2. RagService.query(question, [bookId])
3. LlamaQueryEngine.query(question)
   3a. VectorStoreIndex.asQueryEngine(similarityTopK: 10)
   3b. QueryEngine.query()
       → Retrieve: pgvector cosine similarity
          SQL: "SELECT * FROM document_store
                ORDER BY embedding <=> $1
                LIMIT 10"
       → Synthesize: LLM generates answer
4. Response: { answer, sources }
```

---

## 9. Files thay đổi

### Tạo mới
- `src/rag/llama/index.ts` — LlamaIndex settings
- `src/rag/llama/document-loader.ts` — Document creation
- `src/rag/llama/index-builder.ts` — Index management
- `src/rag/llama/query-engine.ts` — Query wrapper

### Cập nhật
- `src/rag/rag.module.ts` — Simplified, remove layer imports
- `src/rag/rag.service.ts` — Delegate to LlamaIndex

### Xóa
- `src/rag/layers/` — Toàn bộ folder (old Layer 1-3)

---

## 10. Todo List

- [ ] Cài `llamaindex @llamaindex/pg @llamaindex/huggingface pg`
- [ ] Tạo `src/rag/llama/index.ts` (LlamaIndex settings với HuggingFaceEmbedding)
- [ ] Tạo `src/rag/llama/document-loader.ts` (Document creation)
- [ ] Tạo `src/rag/llama/index-builder.ts` (Index management)
- [ ] Tạo `src/rag/llama/query-engine.ts` (Query wrapper)
- [ ] Cập nhật `src/rag/rag.service.ts` (delegate to LlamaIndex)
- [ ] Cập nhật `src/rag/rag.module.ts` (simplified)
- [ ] Xóa `src/rag/layers/` (old Layer 1-3)
- [ ] Cập nhật ChatService để dùng RagService mới
- [ ] Test: upload book → index → query
