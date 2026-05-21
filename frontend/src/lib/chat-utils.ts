// Chat types for DeepRead
export interface ChatMessage {
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
}

export interface StreamResult {
  text: string;
  citations: Citation[];
}

export function createMessage(
  role: "user" | "assistant",
  content: string,
  citations?: Citation[]
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    citations,
    createdAt: new Date(),
  };
}

// Convert ChatMessage to AI SDK format
export function toAIMessages(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}
