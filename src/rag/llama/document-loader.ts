/**
 * Document Loader
 * 
 * Converts book content to LlamaIndex Documents.
 * Document is the atomic unit in LlamaIndex - represents a chunk of text.
 */

import { Document } from 'llamaindex';

export interface Chapter {
  title: string;
  content: string;
}

export interface ChunkMetadata {
  chunkId: string;
  bookId: string;
  bookTitle: string;
  chapter: string;
  chapterIndex: number;
  pageNumber?: number;
  startOffset: number;
  endOffset: number;
}

/**
 * Create a single LlamaIndex Document from book content.
 */
export function createDocument(
  bookId: string,
  bookTitle: string,
  content: string,
  metadata?: Record<string, unknown>,
): Document {
  return new Document({
    text: content,
    metadata: {
      bookId,
      bookTitle,
      chunkId: `book-${bookId}`,
      startOffset: 0,
      endOffset: content.length,
      ...metadata,
    },
    id_: `book-${bookId}`,
  });
}

/**
 * Create multiple LlamaIndex Documents from chapters.
 * Each chapter becomes a separate Document with position metadata for Follow Reading.
 */
export function createDocumentsFromChapters(
  bookId: string,
  bookTitle: string,
  chapters: Chapter[],
  pageNumbers?: number[],
): Document[] {
  let globalOffset = 0;
  
  return chapters.map((chapter, index) => {
    const startOffset = globalOffset;
    const endOffset = startOffset + chapter.content.length;
    const chunkId = `book-${bookId}-chunk-${index}`;
    
    const doc = new Document({
      text: chapter.content,
      metadata: {
        bookId,
        bookTitle,
        chapter: chapter.title,
        chapterIndex: index,
        chunkId,
        pageNumber: pageNumbers?.[index],
        startOffset,
        endOffset,
      },
      id_: chunkId,
    });
    
    globalOffset = endOffset + 1;
    return doc;
  });
}

/**
 * Create a single Document from full book content.
 * Useful when book doesn't have clear chapter structure.
 */
export function createDocumentFromBook(
  bookId: string,
  bookTitle: string,
  content: string,
): Document {
  return new Document({
    text: content,
    metadata: {
      bookId,
      bookTitle,
      chunkId: `book-${bookId}`,
      startOffset: 0,
      endOffset: content.length,
    },
    id_: `book-${bookId}`,
  });
}
