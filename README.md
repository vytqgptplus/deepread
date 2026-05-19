# DeepRead Backend

AI-powered book reading platform backend built with NestJS, TypeORM, and PostgreSQL.

## Features

- **Authentication**: JWT-based authentication with access and refresh tokens
- **Conversations**: Create and manage chat conversations about books
- **AI Chat**: Stream AI responses using OpenRouter API with Server-Sent Events (SSE)
- **Citations**: Automatic citation extraction from AI responses
- **Logging**: Winston-based structured logging with file rotation

## Tech Stack

- NestJS 10.x
- TypeORM with PostgreSQL
- JWT Authentication (Passport)
- OpenRouter API for AI
- Winston for logging
- Docker Compose for infrastructure

## Prerequisites

- Node.js 20.x
- pnpm (recommended) or npm
- Docker and Docker Compose

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

### 3. Start infrastructure with Docker

```bash
docker-compose up -d postgres redis
```

### 4. Run the application

```bash
# Development
pnpm run start:dev

# Production
pnpm run build
pnpm run start:prod
```

## API Documentation

Swagger documentation is available at: `http://localhost:9430/api/docs`

## API Endpoints

### Auth
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login
- `POST /auth/refresh` - Refresh access token

### Conversations
- `GET /conversations` - List conversations
- `POST /conversations` - Create conversation
- `GET /conversations/:id` - Get conversation
- `PATCH /conversations/:id` - Update conversation
- `DELETE /conversations/:id` - Delete conversation

### Chats
- `GET /chats/:conversationId/messages` - Get messages
- `POST /chats/:conversationId/messages` - Send message (non-streaming)
- `POST /chats/:conversationId/stream` - Stream AI response (SSE)
- `DELETE /chats/:conversationId/messages/:id` - Delete message

## Streaming with SSE

To stream AI responses using Server-Sent Events:

```javascript
const response = await fetch('http://localhost:9430/chats/{conversationId}/stream', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer {token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    content: 'Your question here',
    bookContext: [{
      title: 'Book Title',
      content: 'Book excerpt...'
    }]
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const text = decoder.decode(value);
  console.log(text);
}
```

## Docker

Full stack deployment with Docker Compose:

```bash
docker-compose up -d
```

## Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts           # Root module
├── config/                 # Configuration
├── common/                 # Shared utilities
│   ├── decorators/         # Custom decorators
│   ├── filters/            # Exception filters
│   ├── interceptors/       # Logging, transform
│   └── logger/             # Winston logger
├── auth/                   # Authentication module
├── users/                  # Users module (placeholder)
├── books/                  # Books module (placeholder)
├── conversations/          # Conversations module
├── chats/                  # Chats module (SSE streaming)
└── rag/                    # RAG module (placeholder)
```

## License

MIT
