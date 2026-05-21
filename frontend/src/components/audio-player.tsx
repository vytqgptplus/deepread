"use client";

import { useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

type AudioMode = "summary" | "full" | "chapter" | "analysis";

interface AudioPlayerProps {
  bookTitle?: string;
  chapter?: string;
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  volume?: number;
  speed?: number;
  mode?: AudioMode;
  onPlayPause?: () => void;
  onSeek?: (time: number) => void;
  onVolumeChange?: (volume: number) => void;
  onSpeedChange?: (speed: number) => void;
  onModeChange?: (mode: AudioMode) => void;
}

const modes: { value: AudioMode; label: string }[] = [
  { value: "summary", label: "Tóm tắt" },
  { value: "full", label: "Toàn bộ" },
  { value: "chapter", label: "Chương" },
  { value: "analysis", label: "AI Phân tích" },
];

const speeds = [0.5, 1, 1.5, 2];

export function AudioPlayer({
  bookTitle = "Đắc Nhân Tâm",
  chapter = "Chương 7 - Cách Kết Bạn",
  isPlaying = false,
  currentTime = 0,
  duration = 432,
  volume = 0.7,
  speed = 1,
  mode = "summary",
  onPlayPause,
  onSeek,
  onVolumeChange,
  onSpeedChange,
  onModeChange,
}: AudioPlayerProps) {
  const [isMuted, setIsMuted] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = (currentTime / duration) * 100;

  return (
    <div className="bg-card border-t border-border">
      {/* Mode Selector */}
      <div className="flex items-center justify-center gap-2 px-4 py-2 border-b border-border/50">
        {modes.map((m) => (
          <Button
            key={m.value}
            variant={mode === m.value ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-7 text-xs",
              mode === m.value && "bg-primary text-primary-foreground"
            )}
            onClick={() => onModeChange?.(m.value)}
          >
            {m.label}
          </Button>
        ))}
      </div>

      {/* Player Controls */}
      <div className="flex items-center gap-4 px-6 py-4">
        {/* Book Info */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="w-12 h-16 rounded bg-muted overflow-hidden">
            <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
              {bookTitle[0]}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium truncate max-w-[150px]">{bookTitle}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{chapter}</p>
          </div>
        </div>

        {/* Main Controls */}
        <div className="flex-1 flex flex-col items-center gap-2">
          {/* Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onSeek?.(Math.max(0, currentTime - 30))}
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90"
              onClick={onPlayPause}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onSeek?.(Math.min(duration, currentTime + 30))}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-md flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 relative h-1 bg-muted rounded-full overflow-hidden cursor-pointer group">
              <div
                className="absolute inset-y-0 left-0 bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Volume & Speed */}
        <div className="flex items-center gap-4">
          {/* Speed */}
          <div className="flex items-center gap-1">
            {speeds.map((s) => (
              <Button
                key={s}
                variant={speed === s ? "secondary" : "ghost"}
                size="sm"
                className="h-6 w-10 text-xs"
                onClick={() => onSpeedChange?.(s)}
              >
                {s}x
              </Button>
            ))}
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2 w-24">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume * 100]}
              max={100}
              step={1}
              onValueChange={(value) => {
                setIsMuted(false);
                const vol = Array.isArray(value) ? value[0] : value;
                onVolumeChange?.(vol / 100);
              }}
              className="flex-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
