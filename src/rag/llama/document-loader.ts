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
      ...metadata,
    },
    id_: `book-${bookId}`,
  });
}

/**
 * Create multiple LlamaIndex Documents from chapters.
 * Each chapter becomes a separate Document.
 */
export function createDocumentsFromChapters(
  bookId: string,
  bookTitle: string,
  chapters: Chapter[],
): Document[] {
  return chapters.map((chapter, index) =>
    new Document({
      text: chapter.content,
      metadata: {
        bookId,
        bookTitle,
        chapter: chapter.title,
        chapterIndex: index,
      },
      id_: `book-${bookId}-chapter-${index}`,
    }),
  );
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
    },
    id_: `book-${bookId}`,
  });
}
