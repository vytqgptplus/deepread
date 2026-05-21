"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, BookOpen, Sparkles, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Message, Citation } from "@/types";

interface ChatInterfaceProps {
  messages: Message[];
  isLoading?: boolean;
  onSendMessage: (message: string) => void;
  onCitationClick?: (citation: Citation) => void;
}

export function ChatInterface({
  messages,
  isLoading = false,
  onSendMessage,
  onCitationClick,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderMessageContent = (message: Message) => {
    if (message.role === "user") {
      return <p className="text-sm">{message.content}</p>;
    }

    return (
      <div className="space-y-4">
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>
        
        {message.citations && message.citations.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BookOpen className="h-3 w-3" />
              <span>Trích dẫn từ sách</span>
            </div>
            {message.citations.map((citation) => (
              <div
                key={citation.id}
                className="group relative rounded-lg bg-muted/50 p-3 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => onCitationClick?.(citation)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs h-5">
                    {citation.bookTitle}
                  </Badge>
                  {citation.page && (
                    <span className="text-[10px] text-muted-foreground">
                      Trang {citation.page}
                    </span>
                  )}
                  {citation.chapter && (
                    <span className="text-[10px] text-muted-foreground">
                      {citation.chapter}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground italic border-l-2 border-primary/50 pl-2">
                  &ldquo;{citation.text}&rdquo;
                </p>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(citation.text, citation.id);
                    }}
                  >
                    {copiedId === citation.id ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Chào mừng đến với DeepRead</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Đặt câu hỏi về nội dung sách và nhận câu trả lời kèm trích dẫn chính xác từ nguồn gốc.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" && "flex-row-reverse"
              )}
            >
              <Avatar className={cn(
                "h-8 w-8 flex-shrink-0",
                message.role === "assistant" && "bg-primary text-primary-foreground"
              )}>
                {message.role === "user" ? (
                  <>
                    <AvatarImage src="/placeholder-avatar.jpg" />
                    <AvatarFallback>N</AvatarFallback>
                  </>
                ) : (
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    AI
                  </AvatarFallback>
                )}
              </Avatar>

              <div
                className={cn(
                  "flex-1 min-w-0",
                  message.role === "user" && "max-w-[80%]"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {message.role === "user" ? "Bạn" : "DeepRead AI"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {message.createdAt.toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {renderMessageContent(message)}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0 bg-primary text-primary-foreground">
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">DeepRead AI</span>
                </div>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang suy nghĩ...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto relative"
        >
          <div className="relative flex items-end gap-2 bg-muted rounded-2xl p-2 border border-border focus-within:border-primary/50 transition-colors">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Đặt câu hỏi về nội dung sách..."
              className="min-h-[24px] max-h-[200px] flex-1 bg-transparent border-0 resize-none focus-visible:ring-0 p-1 text-sm"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-8 w-8 flex-shrink-0 rounded-lg"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Nhấn Enter để gửi, Shift + Enter để xuống dòng
          </p>
        </form>
      </div>
    </div>
  );
}
