"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Citation } from "@/types";

interface BookViewerProps {
  title?: string;
  author?: string;
  coverUrl?: string;
  currentPage?: number;
  totalPages?: number;
  content?: BookPageContent;
  highlightedCitation?: Citation;
  onPageChange?: (page: number) => void;
}

interface BookPageContent {
  chapter?: string;
  title?: string;
  paragraphs: string[];
  highlights?: {
    start: number;
    end: number;
    citationId?: string;
  }[];
}

export function BookViewer({
  title = "Đắc Nhân Tâm",
  author = "Dale Carnegie",
  coverUrl,
  currentPage = 1,
  totalPages = 256,
  content,
  highlightedCitation,
  onPageChange,
}: BookViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [isDark, setIsDark] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedCitation]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange?.(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange?.(currentPage + 1);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 10, 150));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 10, 70));
  };

  const renderHighlightedText = (text: string, citationId?: string) => {
    if (citationId === highlightedCitation?.id) {
      return (
        <span
          key={citationId}
          ref={highlightRef}
          className="bg-yellow-500/30 border-b-2 border-yellow-500 rounded-sm"
        >
          {text}
        </span>
      );
    }
    return <span key={text}>{text}</span>;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-10 rounded overflow-hidden bg-muted">
            {coverUrl ? (
              <img src={coverUrl} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                {title[0]}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium leading-tight">{title}</h3>
            <p className="text-xs text-muted-foreground">{author}</p>
          </div>
        </div>
        
        {/* Page Navigation */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevPage}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[80px] text-center">
            Trang {currentPage} / {totalPages}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextPage}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div
          className="max-w-xl mx-auto px-8 py-12"
          style={{ fontSize: `${zoom}%` }}
        >
          {content?.chapter && (
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
              {content.chapter}
            </p>
          )}
          
          {content?.title && (
            <h1 className="text-2xl font-bold mb-6">{content.title}</h1>
          )}

          <div className="leading-relaxed text-foreground/90 space-y-4">
            {content?.paragraphs?.map((para, index) => (
              <p key={index} className="text-justify indent-8">
                {para}
              </p>
            ))}

            {!content && (
              <>
                <p className="text-justify indent-8">
                  Tổng thống Franklin D. Roosevelt được biết đến như một trong những tổng thống được yêu mến nhất trong lịch sử Hoa Kỳ. Điều đáng chú ý là ông có một khả năng đặc biệt trong việc nhớ tên người khác.
                </p>
                <p className="text-justify indent-8">
                  Khi đi trên các chuyến tàu hỏa, ông không chỉ chào hỏi những quan chức cấp cao mà còn nhớ được tên của những người hầu xe, nhân viên phục vụ và thậm chí cả những người làm việc lặng lẽ nhất trong các ga tàu.
                </p>
                <p className="text-justify indent-8">
                  Đây chính là bí quyết giúp ông chinh phục được lòng người dân. Trong thế giới kinh doanh, việc nhớ tên cũng có sức mạnh tương tự.
                </p>
                <p className="text-justify indent-8">
                  Hãy nhớ rằng tên gọi, với hầu hết mọi người, là âm thanh quan trọng nhất của bất kỳ ngôn ngữ nào. Nhớ tên người khác là sự thể hiện lịch sự và tôn trọng đơn giản nhất mà bạn có thể dành cho họ.
                </p>
              </>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Footer Controls */}
      <div className="border-t border-border px-4 py-3">
        <Separator className="mb-3" />
        
        <div className="flex items-center justify-between">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut}>
              <ZoomOut className="h-3 w-3" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[40px] text-center">
              {zoom}%
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn}>
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-2 text-xs"
            onClick={() => setIsDark(!isDark)}
          >
            {isDark ? (
              <>
                <Sun className="h-3 w-3" />
                Chế độ sáng
              </>
            ) : (
              <>
                <Moon className="h-3 w-3" />
                Chế độ tối
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
