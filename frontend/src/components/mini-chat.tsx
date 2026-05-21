"use client";

import { useState, useEffect, useRef } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Message } from "@/types";

interface MiniChatProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText?: string;
  bookTitle?: string;
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
}

export function MiniChat({
  isOpen,
  onClose,
  selectedText = "",
  bookTitle = "Sách đang đọc",
  messages,
  isLoading,
  onSendMessage,
}: MiniChatProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-6 w-96 rounded-xl bg-card border border-border shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary-foreground">AI</span>
          </div>
          <span className="text-sm font-medium">Giải thích đoạn này</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Selected Text Quote */}
      {selectedText && (
        <div className="px-4 py-2 bg-muted/30 border-b border-border">
          <p className="text-xs text-muted-foreground italic line-clamp-2">
            &ldquo;{selectedText}&rdquo;
          </p>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="h-64 px-4 py-3">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                Hỏi về đoạn văn bản đã chọn
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" && "justify-end"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang suy nghĩ...</span>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Hỏi thêm về đoạn này..."
            className="min-h-[40px] max-h-[100px] resize-none text-sm"
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="h-[40px] w-[40px] flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
