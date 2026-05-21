export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  totalPages?: number;
  status: "pending" | "processing" | "analyzed";
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  createdAt: Date;
}

export interface Citation {
  id: string;
  bookId: string;
  bookTitle: string;
  page?: number;
  chapter?: string;
  text: string;
  highlightStart?: number;
  highlightEnd?: number;
}

export interface Conversation {
  id: string;
  title: string;
  bookIds: string[];
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRequest {
  message: string;
  bookIds: string[];
  conversationId?: string;
}

export interface ChatResponse {
  message: Message;
  citations: Citation[];
}
