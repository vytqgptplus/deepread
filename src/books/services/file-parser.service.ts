import { Injectable, Logger } from '@nestjs/common';

/**
 * File parser service for extracting text from book files.
 * Supports PDF, EPUB, and TXT formats.
 */
@Injectable()
export class FileParserService {
  private readonly logger = new Logger(FileParserService.name);

  /**
   * Parse a book file and extract text content.
   */
  async parse(
    buffer: Buffer,
    format: 'pdf' | 'epub' | 'txt',
  ): Promise<{ content: string; pages: number }> {
    switch (format) {
      case 'pdf':
        return this.parsePdf(buffer);
      case 'epub':
        return this.parseEpub(buffer);
      case 'txt':
        return this.parseTxt(buffer);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Parse PDF file.
   */
  private async parsePdf(buffer: Buffer): Promise<{ content: string; pages: number }> {
    try {
      // Dynamic import for pdf-parse
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);

      return {
        content: this.cleanText(data.text),
        pages: data.numpages,
      };
    } catch (error) {
      this.logger.error(`PDF parsing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse EPUB file.
   */
  private async parseEpub(buffer: Buffer): Promise<{ content: string; pages: number }> {
    try {
      // Simple EPUB parser - extracts text from HTML content
      const content = buffer.toString('utf-8');

      // Extract text from HTML tags
      let text = content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

      // Estimate pages (assuming ~3000 chars per page)
      const pages = Math.ceil(text.length / 3000);

      return {
        content: this.cleanText(text),
        pages,
      };
    } catch (error) {
      this.logger.error(`EPUB parsing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse TXT file.
   */
  private async parseTxt(buffer: Buffer): Promise<{ content: string; pages: number }> {
    try {
      const content = buffer.toString('utf-8');
      const pages = Math.ceil(content.length / 3000);

      return {
        content: this.cleanText(content),
        pages,
      };
    } catch (error) {
      this.logger.error(`TXT parsing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean extracted text.
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/^\s+|\s+$/gm, '')
      .trim();
  }

  /**
   * Chunk text into segments for RAG.
   */
  chunkText(text: string, chunkSize = 1000, overlap = 100): string[] {
    const chunks: string[] = [];
    const sentences = this.splitIntoSentences(text);

    let currentChunk = '';
    let currentSize = 0;

    for (const sentence of sentences) {
      const sentenceLength = sentence.length;

      if (currentSize + sentenceLength > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        // Keep overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(overlap / 5)).join(' ');
        currentChunk = overlapWords + ' ' + sentence;
        currentSize = currentChunk.length;
      } else {
        currentChunk += ' ' + sentence;
        currentSize += sentenceLength + 1;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Split text into sentences.
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting
    return text
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 0);
  }

  /**
   * Extract chapters from text.
   */
  extractChapters(text: string): Array<{ chapter: string; content: string }> {
    const chapters: Array<{ chapter: string; content: string }> = [];

    // Pattern to detect chapter headings
    const chapterPattern = /(?:^|\n)(Chapter|CHAPTER|Part|PART)\s+(\d+|[IVXLCDM]+)[.:]\s*(.+)/gi;
    const lines = text.split('\n');

    let currentChapter = { name: 'Introduction', content: '' };

    for (const line of lines) {
      const match = chapterPattern.exec(line);
      if (match) {
        if (currentChapter.content.length > 0) {
          chapters.push({
            chapter: currentChapter.name,
            content: currentChapter.content.trim(),
          });
        }
        currentChapter = {
          name: `${match[1]} ${match[2]}: ${match[3]}`.substring(0, 100),
          content: '',
        };
      } else {
        currentChapter.content += '\n' + line;
      }
    }

    // Add last chapter
    if (currentChapter.content.length > 0) {
      chapters.push({
        chapter: currentChapter.name,
        content: currentChapter.content.trim(),
      });
    }

    // If no chapters detected, treat entire text as one chapter
    if (chapters.length === 0) {
      chapters.push({
        chapter: 'Full Text',
        content: text.trim(),
      });
    }

    return chapters;
  }
}
