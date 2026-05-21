"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, MessageSquare, Library, Settings, Plus, Search, LogOut, User, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Book } from "@/types";

interface SidebarProps {
  books?: Book[];
  selectedBookIds?: string[];
  onBookSelect?: (bookId: string) => void;
  onNewChat?: () => void;
}

const navigation = [
  { name: "Cuộc trò chuyện", href: "/", icon: MessageSquare },
  { name: "Thư viện sách", href: "/library", icon: Library },
];

export function Sidebar({ books = [], selectedBookIds = [], onBookSelect, onNewChat }: SidebarProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredBooks = books.filter(
    (book) =>
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 px-4 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          D
        </div>
        <span className="text-lg font-semibold">DeepRead</span>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80"
        >
          <Plus className="h-4 w-4" />
          Cuộc trò chuyện mới
        </Button>
      </div>

      {/* Navigation */}
      <nav className="px-3 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Books Section */}
      <div className="mt-4 px-3">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
            Sách của tôi
          </span>
          <Link
            href="/library"
            className="text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground"
          >
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        
        {/* Search Books */}
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-sidebar-foreground/50" />
          <Input
            placeholder="Tìm sách..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-7 text-xs bg-background/50 border-sidebar-border"
          />
        </div>

        {/* Book List */}
        <ScrollArea className="h-[200px] pr-3">
          <div className="space-y-1">
            {filteredBooks.map((book) => {
              const isSelected = selectedBookIds.includes(book.id);
              return (
                <button
                  key={book.id}
                  onClick={() => onBookSelect?.(book.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors",
                    isSelected
                      ? "bg-sidebar-accent"
                      : "hover:bg-sidebar-accent/50"
                  )}
                >
                  <div className="h-8 w-6 rounded bg-muted flex-shrink-0 overflow-hidden">
                    {book.coverUrl ? (
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BookOpen className="h-4 w-4 m-1 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{book.title}</p>
                    <p className="text-[10px] text-sidebar-foreground/50 truncate">
                      {book.author}
                    </p>
                  </div>
                  {book.status === "analyzed" && (
                    <Badge variant="secondary" className="h-4 text-[8px] px-1">
                      ✓
                    </Badge>
                  )}
                  {book.status === "processing" && (
                    <Badge variant="secondary" className="h-4 text-[8px] px-1 bg-yellow-500/20 text-yellow-500">
                      ⏳
                    </Badge>
                  )}
                </button>
              );
            })}
            {filteredBooks.length === 0 && (
              <p className="text-xs text-sidebar-foreground/50 text-center py-4">
                Chưa có sách nào
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User Menu */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent cursor-pointer transition-colors">
          <Avatar className="h-8 w-8">
            <AvatarImage src="/placeholder-avatar.jpg" />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              N
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Nguyen Van A</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">user@example.com</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
