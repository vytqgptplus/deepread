"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  Search,
  Filter,
  BookOpen,
  MoreVertical,
  Trash2,
  Download,
  Loader2,
  FileText,
  Check,
  Clock,
} from "lucide-react";
import type { Book } from "@/types";

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
  {
    id: "5",
    title: "Think and Grow Rich",
    author: "Napoleon Hill",
    status: "analyzed",
    totalPages: 238,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "6",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    status: "analyzed",
    totalPages: 256,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "7",
    title: "Tâm Lý Học Về Tiền",
    author: "DeepRead Premium",
    status: "analyzed",
    totalPages: 200,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "8",
    title: "Kỹ Năng Giao Tiếp",
    author: "DeepRead Premium",
    status: "analyzed",
    totalPages: 180,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>(mockBooks);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);

  const myBooks = books.filter((b) => !b.author.includes("DeepRead"));
  const systemBooks = books.filter((b) => b.author.includes("DeepRead"));
  const processingBooks = books.filter((b) => b.status === "processing");

  const filteredBooks = books.filter(
    (book) =>
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const bookFiles = files.filter(
      (file) =>
        file.type === "application/pdf" ||
        file.name.endsWith(".epub") ||
        file.name.endsWith(".mobi")
    );

    if (bookFiles.length > 0) {
      handleUpload(bookFiles);
    }
  }, []);

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    // Simulate upload
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsUploading(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleUpload(files);
    }
  };

  const handleBookSelect = (bookId: string) => {
    setSelectedBookIds((prev) => {
      if (prev.includes(bookId)) {
        return prev.filter((id) => id !== bookId);
      }
      return [...prev, bookId];
    });
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar
        books={myBooks}
        selectedBookIds={selectedBookIds}
        onBookSelect={handleBookSelect}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold">Thư Viện Sách</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Quản lý sách của bạn và khám phá nội dung mới
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Xuất sách
            </Button>
            <Button size="sm" className="gap-2 bg-primary">
              <Upload className="h-4 w-4" />
              Tải lên sách
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3 px-4 py-3 bg-background rounded-lg border border-border">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{books.length}</p>
              <p className="text-xs text-muted-foreground">Tổng sách</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 bg-background rounded-lg border border-border">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">156</p>
              <p className="text-xs text-muted-foreground">Cuộc trò chuyện</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 bg-background rounded-lg border border-border">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Check className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">2,340</p>
              <p className="text-xs text-muted-foreground">Trang đã đọc</p>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm sách..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Bộ lọc
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="flex-1 px-6 overflow-hidden flex flex-col">
          <TabsList className="mb-4">
            <TabsTrigger value="all" className="gap-2">
              Tất cả
              <Badge variant="secondary" className="h-5 text-xs">
                {books.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="my" className="gap-2">
              Sách của tôi
              <Badge variant="secondary" className="h-5 text-xs">
                {myBooks.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              Hệ thống
              <Badge variant="secondary" className="h-5 text-xs">
                {systemBooks.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="processing" className="gap-2">
              Đang xử lý
              <Badge variant="secondary" className="h-5 text-xs">
                {processingBooks.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Upload Zone */}
          <div
            className={`
              border-2 border-dashed rounded-xl p-8 mb-6 text-center transition-colors cursor-pointer
              ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              multiple
              accept=".pdf,.epub,.mobi"
              className="hidden"
              id="file-upload"
              onChange={handleFileInput}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              {isUploading ? (
                <>
                  <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Đang tải lên...</p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">Kéo thả sách vào đây</p>
                  <p className="text-xs text-muted-foreground">
                    hoặc click để chọn file từ máy tính
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Badge variant="secondary">PDF</Badge>
                    <Badge variant="secondary">EPUB</Badge>
                    <Badge variant="secondary">MOBI</Badge>
                  </div>
                </>
              )}
            </label>
          </div>

          {/* Book Grid */}
          <ScrollArea className="flex-1">
            <TabsContent value="all" className="mt-0 h-full">
              <BookGrid books={filteredBooks} />
            </TabsContent>
            <TabsContent value="my" className="mt-0 h-full">
              <BookGrid books={myBooks} />
            </TabsContent>
            <TabsContent value="system" className="mt-0 h-full">
              <BookGrid books={systemBooks} />
            </TabsContent>
            <TabsContent value="processing" className="mt-0 h-full">
              <BookGrid books={processingBooks} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}

function BookGrid({ books }: { books: Book[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {books.map((book) => (
        <div
          key={book.id}
          className="group rounded-xl border border-border bg-card hover:border-primary/50 transition-all cursor-pointer"
        >
          {/* Cover */}
          <div className="aspect-[3/4] bg-muted rounded-t-xl overflow-hidden relative">
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <span className="text-4xl font-bold text-muted-foreground/50">
                {book.title[0]}
              </span>
            </div>
            {book.status === "processing" && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-3">
            <h3 className="font-medium text-sm truncate mb-1">{book.title}</h3>
            <p className="text-xs text-muted-foreground truncate mb-2">{book.author}</p>
            <div className="flex items-center justify-between">
              {book.status === "analyzed" && (
                <Badge variant="secondary" className="h-5 text-[10px] gap-1 bg-green-500/10 text-green-600">
                  <Check className="h-3 w-3" />
                  Đã phân tích
                </Badge>
              )}
              {book.status === "processing" && (
                <Badge variant="secondary" className="h-5 text-[10px] gap-1 bg-yellow-500/10 text-yellow-600">
                  <Clock className="h-3 w-3" />
                  Đang xử lý
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="secondary" size="icon" className="h-7 w-7 bg-background/90">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}

      {books.length === 0 && (
        <div className="col-span-full py-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Không tìm thấy sách nào</p>
        </div>
      )}
    </div>
  );
}
