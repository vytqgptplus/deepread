"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { BookViewer } from "@/components/book-viewer";
import { ChatInterface } from "@/components/chat-interface";
import { MiniChat } from "@/components/mini-chat";
import { Button } from "@/components/ui/button";
import { X, BookOpen, MessageSquare } from "lucide-react";
import type { Book, Message, Citation } from "@/types";

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
];

const mockMessages: Message[] = [
  {
    id: "1",
    role: "user",
    content: "Kể thêm ví dụ về việc nhớ tên trong cuốn sách",
    createdAt: new Date(),
  },
  {
    id: "2",
    role: "assistant",
    content: `Có, Carnegie cung cấp nhiều ví dụ thực tế từ giới kinh doanh. Một trong những ví dụ nổi bật nhất:

**Tổng thống Franklin D. Roosevelt** nhớ tên của những người hầu xe trong các chuyến tàu hỏa. Ông ấy luôn chào hỏi họ bằng tên khi gặp lại. Đây là lý do ông được nhiều người yêu mến và ủng hộ.

**Một doanh nhân thành công ở Philadelphia** kể lại rằng ông đã nhớ được tên của hàng trăm nhân viên trong cửa hàng của mình. Việc này giúp ông tạo được lòng trung thành và tăng năng suất làm việc đáng kể.

Bạn có muốn tôi điều hướng đến các trang này trong sách không?`,
    citations: [
      {
        id: "c1",
        bookId: "1",
        bookTitle: "Đắc Nhân Tâm",
        page: 89,
        chapter: "Chương 7",
        text: "Tổng thống Franklin D. Roosevelt nhớ tên của những người hầu xe trong các chuyến tàu hỏa. Ông ấy luôn chào hỏi họ bằng tên khi gặp lại.",
      },
      {
        id: "c2",
        bookId: "1",
        bookTitle: "Đắc Nhân Tâm",
        page: 92,
        chapter: "Chương 7",
        text: "Một doanh nhân thành công ở Philadelphia kể lại rằng ông đã nhớ được tên của hàng trăm nhân viên trong cửa hàng của mình.",
      },
    ],
    createdAt: new Date(),
  },
];

const bookContent = {
  chapter: "Chương 7",
  title: "Cách Kết Bạn và Gây Ấn Tượng Tốt",
  paragraphs: [
    "Tổng thống Franklin D. Roosevelt được biết đến như một trong những tổng thống được yêu mến nhất trong lịch sử Hoa Kỳ. Điều đáng chú ý là ông có một khả năng đặc biệt trong việc nhớ tên người khác.",
    "Khi đi trên các chuyến tàu hỏa, ông không chỉ chào hỏi những quan chức cấp cao mà còn nhớ được tên của những người hầu xe, nhân viên phục vụ và thậm chí cả những người làm việc lặng lẽ nhất trong các ga tàu. Đây chính là bí quyết giúp ông chinh phục được lòng người dân.",
    "Trong thế giới kinh doanh, việc nhớ tên cũng có sức mạnh tương tự. Một doanh nhân thành công ở Philadelphia đã chia sẻ rằng ông có thể nhớ tên của hơn ba trăm nhân viên trong cửa hàng của mình.",
    "Hãy nhớ rằng tên gọi, với hầu hết mọi người, là âm thanh quan trọng nhất của bất kỳ ngôn ngữ nào. Nhớ tên người khác là sự thể hiện lịch sự và tôn trọng đơn giản nhất mà bạn có thể dành cho họ.",
    "Khi bạn gặp ai đó lần đầu, hãy cố gắng nhớ tên của họ. Nếu bạn quên, đừng ngại hỏi lại. Việc hỏi lại tên cho thấy bạn thực sự quan tâm đến người đó.",
  ],
};

export default function FollowReadingPage() {
  const router = useRouter();
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>(["1"]);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [isMiniChatOpen, setIsMiniChatOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(89);
  const [highlightedCitation, setHighlightedCitation] = useState<Citation | null>(null);

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

    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Tính năng Follow Reading cho phép bạn xem nội dung sách được trích dẫn ngay bên cạnh câu trả lời của AI.`,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleCitationClick = (citation: Citation) => {
    setHighlightedCitation(citation);
    setCurrentPage(citation.page || 89);
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

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Exit Button */}
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Thoát
          </Button>
        </div>

        {/* Chat Panel */}
        <div className="w-1/2 flex flex-col border-r border-border">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Đắc Nhân Tâm - AI Chat</span>
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 overflow-hidden">
            <ChatInterface
              messages={messages}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              onCitationClick={handleCitationClick}
            />
          </div>
        </div>

        {/* Book Panel */}
        <div className="w-1/2 flex flex-col bg-background">
          <BookViewer
            title="Đắc Nhân Tâm"
            author="Dale Carnegie"
            currentPage={currentPage}
            totalPages={256}
            content={bookContent}
            highlightedCitation={highlightedCitation ?? undefined}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* Mini Chat */}
      <MiniChat
        isOpen={isMiniChatOpen}
        onClose={() => setIsMiniChatOpen(false)}
        messages={[]}
        isLoading={false}
        onSendMessage={() => {}}
      />
    </div>
  );
}
