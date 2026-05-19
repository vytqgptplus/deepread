---
name: Books & RAG Module Implementation
overview: Hoàn thiện Books Module với MinIO storage và implement RAG Module với 3-layer retrieval pipeline (vector search, keyword search, reranking) sử dụng pgvector, transformers.js, và BM25
todos:
  - id: docker-compose
    content: "Update docker-compose.yml: Add MinIO, enable pgvector"
    status: completed
  - id: books-controller
    content: Create Books Controller với CRUD + upload
    status: completed
  - id: books-service
    content: Create Books Service với MinIO integration
    status: completed
  - id: file-parser
    content: Create File Parser Service (PDF/EPUB)
    status: completed
  - id: rag-module
    content: Create RAG Module structure
    status: completed
  - id: rag-layer1
    content: "Implement Layer 1: Query Expansion"
    status: completed
  - id: rag-layer2
    content: "Implement Layer 2: Vector Search + Keyword Search + Reranking"
    status: completed
  - id: rag-layer3
    content: "Implement Layer 3: Context Assembly"
    status: completed
  - id: rag-entities
    content: Create RAG entities (BookChunk, ChunkEmbedding)
    status: completed
  - id: chat-rag
    content: Update ChatService to use RagService
    status: completed
  - id: env-storage
    content: Update .env, create storage folder
    status: completed
  - id: test
    content: Test full flow
    status: in_progress
isProject: false
---

# Books & RAG Module Implementation Plan

## Phase 1: Books Module Enhancement

### 1.1 Infrastructure - MinIO Setup
- Add MinIO container to docker-compose.yml (port 9430 for API, 9431 for console)
- Create MinIO bucket `deepread-books` for file storage
- Configure CORS for file access

### 1.2 Books Module Structure
```
src/books/
├── books.module.ts
├── books.controller.ts      # REST endpoints
├── books.service.ts         # Business logic
├── dto/
│   ├── create-book.dto.ts
│   ├── update-book.dto.ts
│   └── book-response.dto.ts
├── entities/
│   └── book.entity.ts       # Updated with MinIO fields
├── providers/
│   ├── minio.provider.ts    # MinIO client
│   └── storage.provider.ts   # File storage abstraction
└── services/
    └── file-parser.service.ts  # PDF/EPUB parsing
```

### 1.3 API Endpoints
| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/books` | List user's books (paginated) |
| POST | `/books/upload` | Upload book file (multipart) |
| GET | `/books/:id` | Get book details |
| PATCH | `/books/:id` | Update book metadata |
| DELETE | `/books/:id` | Delete book + file |
| GET | `/books/:id/content` | Get book content (for reader) |
| GET | `/books/:id/chunks` | Get processed chunks |
| POST | `/books/:id/process` | Trigger RAG processing |

### 1.4 Book Processing
- Parse PDF/EPUB files
- Extract text content with page numbers
- Chunk content into segments (500-1000 chars each)
- Store metadata: title, author, pages, content preview

## Phase 2: RAG Module

### 2.1 RAG Module Structure
```
src/rag/
├── rag.module.ts
├── rag.service.ts           # Main RAG orchestration
├── layers/
│   ├── layer1-query-expansion.service.ts
│   ├── layer2-vector-search.service.ts
│   ├── layer2-keyword-search.service.ts
│   ├── layer2-reranker.service.ts
│   └── layer3-context-assembly.service.ts
├── entities/
│   ├── book-chunk.entity.ts
│   └── chunk-embedding.entity.ts
└── dto/
    ├── rag-query.dto.ts
    └── rag-context.dto.ts
```

### 2.2 Database Entities

**BookChunk Entity:**
```typescript
// Chunks content of books for retrieval
@Entity('book_chunks')
export class BookChunk {
  id: string;
  bookId: string;
  chunkIndex: number;
  chapter: string;
  pageStart: number;
  pageEnd: number;
  content: string;
  metadata: Record<string, unknown>;
}
```

**ChunkEmbedding Entity:**
```typescript
// Vector embeddings for semantic search
@Entity('chunk_embeddings')
export class ChunkEmbedding {
  id: string;
  chunkId: string;
  content: string;  // Text for BM25
  metadata: Record<string, unknown>;  // Serialized vector for pgvector
}
```

### 2.3 Three-Layer RAG Pipeline

**Layer 1: Query Expansion**
- Parse user question
- Extract keywords and concepts
- Generate query variations

**Layer 2: Multi-Stage Retrieval**
1. Dense Vector Search: Query embeddings → Top-20 chunks
2. Keyword Search: BM25 → Top-20 chunks
3. Reranking: Combine scores → Top-10 chunks

**Layer 3: Context Assembly**
- Combine top chunks with metadata
- Format for prompt injection

### 2.4 Update ChatService
- Import RagService
- Add `useRag: boolean` flag to CreateMessageDto
- When useRag=true: retrieve context → inject into prompt
- When useRag=false: use system prompt only

## Phase 3: Docker & Infrastructure

### 3.1 Update docker-compose.yml
```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "9432:5432"
    environment:
      POSTGRES_DB: deepread
      POSTGRES_USER: deepread
      POSTGRES_PASSWORD: deepread_secret
    volumes:
      - postgres_data:/var/lib/postgresql/data
    command: postgres -c shared_preload_libraries=vector

  minio:
    image: minio/minio
    ports:
      - "9430:9000"   # API
      - "9431:9001"   # Console
    environment:
      MINIO_ROOT_USER: deepread
      MINIO_ROOT_PASSWORD: deepread_secret
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"

  createbuckets:
    image: minio/mc
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      mc alias set myminio http://minio:9000 deepread deepread_secret;
      mc mb myminio/deepread-books --ignore-existing;
      exit 0;
      "
```

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| Modify | `docker-compose.yml` | Add MinIO, enable pgvector |
| Create | `src/books/books.controller.ts` | REST endpoints |
| Create | `src/books/books.service.ts` | Business logic |
| Create | `src/books/providers/minio.provider.ts` | MinIO client |
| Create | `src/books/services/file-parser.service.ts` | PDF/EPUB parsing |
| Create | `src/rag/rag.module.ts` | RAG module |
| Create | `src/rag/rag.service.ts` | Main orchestration |
| Create | `src/rag/layers/*.ts` | 3-layer pipeline |
| Create | `src/rag/entities/*.ts` | Chunk entities |
| Modify | `src/chats/chat.service.ts` | Integrate RagService |
| Create | `.env.example` | Update with MinIO vars |
| Create | `storage/sample-books/` | Placeholder for test books |

## Dependencies to Add

```json
{
  "minio": "^8.5.0",
  "@types/multer": "^1.4.11",
  "pdf-parse": "^1.1.1",
  "epub2": "^3.0.2",
  "multer": "^1.4.5-lts.1",
  "pgvector": "^0.1.8"
}
```

## Testing Flow

1. Upload sample book (PDF/EPUB) via API
2. Trigger `/books/:id/process` to create chunks
3. Create conversation with books
4. Chat with `useRag=true`
5. Verify AI uses book content with citations

## Output
- Books API endpoints ready for frontend
- RAG pipeline with 3-layer retrieval
- Chat integrates RAG when enabled
- All services containerized with Docker