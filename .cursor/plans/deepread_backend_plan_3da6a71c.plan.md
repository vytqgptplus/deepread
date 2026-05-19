---
name: DeepRead Backend Plan
overview: Tạo backend NestJS cho nền tảng đọc sách tích hợp AI với modules auth, users, books, conversations, chats, rag. Ưu tiên hoàn thiện conversations và chats với SSE streaming, JWT auth, Docker compose với port 9xxx.
todos:
  - id: setup
    content: Setup NestJS project với cấu trúc modules và dependencies
    status: completed
  - id: docker
    content: Tạo Docker Compose với PostgreSQL, Redis (port 9xxx)
    status: completed
  - id: auth
    content: Implement Module Auth với JWT
    status: completed
  - id: conversations
    content: Implement Module Conversations (CRUD)
    status: completed
  - id: chats
    content: Implement Module Chats với SSE Streaming (PRIORITY)
    status: completed
  - id: placeholders
    content: "Tạo Placeholder modules: users, books, rag"
    status: completed
  - id: logging
    content: Setup logging với Winston
    status: completed
  - id: postman
    content: Export Postman API collection
    status: completed
isProject: false
---

# DeepRead Backend - Kế hoạch phát triển

## Cấu trúc thư mục

```
deepread/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/        # Custom decorators (auth, roles)
│   │   ├── filters/           # Exception filters
│   │   ├── guards/             # Auth guards
│   │   ├── interceptors/      # Logging, transform interceptors
│   │   └── utils/             # Helper functions
│   ├── config/
│   │   └── configuration.ts   # ENV configuration
│   ├── auth/                   # Module: Auth (JWT)
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   ├── guards/
│   │   └── dto/
│   ├── users/                  # Module: Users (placeholder)
│   ├── books/                  # Module: Books (placeholder)
│   ├── conversations/          # Module: Conversations
│   │   ├── conversation.module.ts
│   │   ├── conversation.controller.ts
│   │   ├── conversation.service.ts
│   │   ├── conversation.entity.ts
│   │   └── dto/
│   ├── chats/                  # Module: Chats (PRIORITY)
│   │   ├── chat.module.ts
│   │   ├── chat.controller.ts
│   │   ├── chat.service.ts
│   │   ├── chat-gateway.ts     # SSE Gateway
│   │   ├── chat.entity.ts
│   │   ├── message.entity.ts
│   │   └── dto/
│   └── rag/                    # Module: RAG (placeholder)
├── .postman/
│   └── deepread-api.json       # Postman collection
├── docker-compose.yml
├── .env.example
├── package.json
└── tsconfig.json
```

## Chi tiết từng bước

### 1. Setup Project & Infrastructure
- Khởi tạo NestJS project với `pnpm`
- Cấu hình TypeORM kết nối PostgreSQL
- Setup Docker Compose với services: app (9xxx), postgres (9xxx), redis (9xxx)
- Cấu hình Winston logger
- Setup global exception filter với tracking

### 2. Module Auth (JWT)
- **AuthController**: endpoints login, register, refresh token
- **AuthService**: validate user, generate JWT tokens
- **JwtStrategy**: Passport strategy
- **JwtAuthGuard**: Bảo vệ routes cần auth
- **Entities**: User entity với fields cơ bản

### 3. Module Conversations (Hoàn thiện)
- **ConversationController**: CRUD conversations
  - `GET /conversations` - List user's conversations
  - `POST /conversations` - Create new conversation
  - `GET /conversations/:id` - Get conversation details
  - `DELETE /conversations/:id` - Delete conversation
- **ConversationService**: Business logic
- **ConversationEntity**: id, title, userId, bookIds[], createdAt, updatedAt

### 4. Module Chats - Phần quan trọng nhất (Hoàn thiện)

#### 4.1 Data Models
```typescript
// Message Entity
- id, conversationId, role (user/assistant/system), content
- citations: [{bookId, page, excerpt}] // Trích dẫn từ sách
- metadata: { tokens, model, streaming }
- createdAt
```

#### 4.2 ChatController - REST Endpoints
- `POST /chats/:conversationId/messages` - Send message (khởi tạo stream)
- `GET /chats/:conversationId/messages` - Get message history
- `DELETE /chats/:conversationId/messages/:messageId` - Delete message

#### 4.3 ChatGateway - SSE Streaming (PRIORITY)
- Endpoint SSE: `GET /chats/:conversationId/stream`
- Khi user gửi message:
  1. Lưu message vào DB với status "streaming"
  2. Gọi OpenRouter API với stream: true
  3. Stream từng chunk về client qua SSE
  4. Khi complete, update message content + citations trong DB
- Xử lý citations: AI trả lời kèm markdown với citations → parse và lưu

#### 4.4 ChatService - Business Logic
- Xây dựng prompt context từ conversation history + selected books
- Gọi OpenRouter API
- Parse citations từ AI response (format: `[{page: 42, excerpt: "..."}]`)

### 5. Modules Placeholder
- **users/**: Chỉ tạo structure rỗng, entity User cơ bản
- **books/**: Chỉ tạo structure rỗng, entity Book cơ bản
- **rag/**: Chỉ tạo structure rỗng

### 6. Postman API Documentation
- Export tất cả endpoints vào `.postman/deepread-api.json`
- Bao gồm: Auth, Conversations, Chats
- Mỗi endpoint có description, headers, body example

## Database Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  name VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Conversation Books (many-to-many)
CREATE TABLE conversation_books (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, book_id)
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT,
  citations JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Books (placeholder)
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR,
  author VARCHAR,
  file_path VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Environment Variables

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=9432
DATABASE_USER=deepread
DATABASE_PASSWORD=deepread_secret
DATABASE_NAME=deepread

# Redis
REDIS_HOST=localhost
REDIS_PORT=9439

# App
PORT=9430
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=anthropic/claude-3-haiku
```

## Công nghệ bổ sung
- **class-validator** + **class-transformer**: DTO validation
- **Passport** + **@nestjs/jwt**: JWT authentication
- **Winston**: Structured logging
- **SSE (Server-Sent Events)**: Native implementation trong NestJS

## Output cuối cùng
- Source code hoàn chỉnh
- Docker Compose file
- Postman collection với all APIs
- README.md với setup instructions