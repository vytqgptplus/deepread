"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatInterface } from "@/components/chat-interface";
import { MiniChat } from "@/components/mini-chat";
import { AudioPlayer } from "@/components/audio-player";
import type { Book, Message, Citation } from "@/types";

// Mock data
const mockBooks: Book[] = [
  {
    id: "1",
    title: "Đắc Nhân Tâm",
    author: "Dale Carnegie",
    status: "analyzed",
    totalPages: 256,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    title: "Nhà Giả Kim",
    author: "Paulo Coelho",
    status: "analyzed",
    totalPages: 208,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "3",
    title: "Sapiens",
    author: "Yuval Noah Harari",
    status: "analyzed",
    totalPages: 443,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "4",
    title: "Atomic Habits",
    author: "James Clear",
    status: "processing",
    totalPages: 320,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockMessages: Message[] = [
  {
    id: "1",
    role: "user",
    content: "Chương về cách kết bạn trong cuốn \"Đắc Nhân Tâm\" nói gì về việc nhớ tên người khác? Tại sao điều này quan trọng?",
    createdAt: new Date(Date.now() - 120000),
  },
  {
    id: "2",
    role: "assistant",
    content: `Cuốn "Đắc Nhân Tâm" của Dale Carnegie có một chương riêng về việc trở thành người thú vị và cách kết bạn. Trong đó, ông nhấn mạnh tầm quan trọng của việc nhớ và sử dụng tên người khác.

Theo Carnegie, **tên gọi là yếu tố quan trọng nhất** đối với bất kỳ ai trong giao tiếp. Ông viết rằng mọi người đều yêu thích âm thanh của tên riêng mình - đó là âm thanh êm dịu và dễ chịu nhất trong bất kỳ ngôn ngữ nào.

**Tại sao điều này quan trọng?**

1. **Tạo cảm giác được quan tâm** - Khi ai đó nhớ tên bạn, bạn cảm thấy quan trọng và được coi trọng.

2. **Xây dựng niềm tin** - Việc sử dụng đúng tên cho thấy bạn thực sự chú ý đến họ.

3. **Tăng khả năng ghi nhớ** - Não bộ của bạn sẽ ghi nhớ thông tin tốt hơn khi liên kết với tên.`,
    citations: [
      {
        id: "c1",
        bookId: "1",
        bookTitle: "Đắc Nhân Tâm",
        page: 89,
        chapter: "Chương 7",
        text: "Hãy nhớ rằng tên gọi, với hầu hết mọi người, là âm thanh quan trọng nhất của bất kỳ ngôn ngữ nào. Nhớ tên người khác là sự thể hiện lịch sự và tôn trọng đơn giản nhất mà bạn có thể dành cho họ.",
      },
      {
        id: "c2",
        bookId: "1",
        bookTitle: "Đắc Nhân Tâm",
        page: 90,
        chapter: "Chương 7",
        text: "Tổng thống Franklin D. Roosevelt nhớ tên của những người hầu xe trong các chuyến tàu hỏa. Ông ấy luôn chào hỏi họ bằng tên khi gặp lại.",
      },
    ],
    createdAt: new Date(Date.now() - 60000),
  },
];

export default function HomePage() {
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>(["1"]);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [isMiniChatOpen, setIsMiniChatOpen] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [selectedText, setSelectedText] = useState("");

  const handleBookSelect = (bookId: string) => {
    setSelectedBookIds((prev) => {
      if (prev.includes(bookId)) {
        return prev.filter((id) => id !== bookId);
      }
      return [...prev, bookId];
    });
  };

  const handleSendMessage = async (message: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: message,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Đây là câu trả lời mẫu cho: "${message}". Trong ứng dụng thực tế, AI sẽ trả lời dựa trên nội dung sách đã chọn.`,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleCitationClick = (citation: Citation) => {
    console.log("Navigate to citation:", citation);
    // In real app, this would navigate to the book at the specific page
  };

  const handleMiniChatMessage = (message: string) => {
    console.log("Mini chat message:", message);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar
        books={mockBooks}
        selectedBookIds={selectedBookIds}
        onBookSelect={handleBookSelect}
        onNewChat={() => setMessages([])}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            onCitationClick={handleCitationClick}
          />
        </div>

        {/* Audio Player */}
        <AudioPlayer
          isPlaying={isAudioPlaying}
          onPlayPause={() => setIsAudioPlaying(!isAudioPlaying)}
        />
      </div>

      {/* Mini Chat */}
      <MiniChat
        isOpen={isMiniChatOpen}
        onClose={() => setIsMiniChatOpen(false)}
        selectedText={selectedText}
        messages={[]}
        isLoading={false}
        onSendMessage={handleMiniChatMessage}
      />
    </div>
  );
}
