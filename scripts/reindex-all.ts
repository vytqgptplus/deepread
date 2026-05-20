/**
 * Reindex Script - Rebuild RAG index for all books
 * 
 * This script rebuilds the vector index for all books in the database.
 * Use this after changing:
 * - Embedding model
 * - Chunk size/overlap
 * - Node parser configuration
 * 
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/reindex-all.ts
 *   pnpm run reindex
 * 
 * Prerequisites:
 *   - Docker containers running (postgres, minio)
 *   - Database accessible
 *   - Books already uploaded
 */

import * as fs from 'fs';
import * as path from 'path';

// Set up paths
const ROOT_DIR = path.join(__dirname, '..');
process.chdir(ROOT_DIR);

import { initializeLlamaIndex } from '../src/rag/llama/settings';
import { IndexBuilder } from '../src/rag/llama/index-builder';
import { createDocumentsFromChapters } from '../src/rag/llama/document-loader';
import { FileParserService } from '../src/books/services/file-parser.service';

const fileParserService = new FileParserService();

// Database config for IndexBuilder (uses PGVectorStore port)
const INDEX_DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '9432', 10),
  database: process.env.DB_NAME || 'deepread',
  user: process.env.DB_USER || 'deepread',
  password: process.env.DB_PASSWORD || 'deepread_secret',
};

// Direct PostgreSQL config (standard PG port 5432, not the mapped port 9432)
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '9432', 10) - 10000 || 5432,
  database: process.env.DB_NAME || 'deepread',
  user: process.env.DB_USER || 'deepread',
  password: process.env.DB_PASSWORD || 'deepread_secret',
};

interface BookRecord {
  id: string;
  title: string | null;
  fileName: string | null;
  content: string | null;
}

async function getAllBooks(): Promise<BookRecord[]> {
  const { Client } = require('pg');
  const client = new Client(DB_CONFIG);
  
  try {
    await client.connect();
    const result = await client.query(
      'SELECT id, title, "fileName", content FROM book ORDER BY "createdAt" ASC'
    );
    return result.rows as BookRecord[];
  } finally {
    await client.end();
  }
}

async function truncateVectorTable(): Promise<void> {
  const { Client } = require('pg');
  const client = new Client(DB_CONFIG);
  
  try {
    await client.connect();
    await client.query('TRUNCATE TABLE IF EXISTS "data_embeddings" CASCADE');
    console.log('Vector table truncated');
  } catch {
    console.log('Vector table truncate skipped (may not exist)');
  } finally {
    await client.end();
  }
}

async function reindexAllBooks(): Promise<void> {
  console.log('=== RAG Reindex Script ===');
  console.log('This will rebuild the vector index for ALL books.');
  console.log('');
  console.log(`Database: ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);
  console.log('');

  console.log('Initializing LlamaIndex...');
  initializeLlamaIndex();
  console.log('Note: Downloading multilingual embedding model on first run...');
  console.log('');

  const books = await getAllBooks();
  console.log(`Found ${books.length} books to reindex`);
  console.log('');

  if (books.length === 0) {
    console.log('No books found. Exiting.');
    return;
  }

  const clearVectors = process.argv.includes('--clear');
  if (clearVectors) {
    await truncateVectorTable();
  }

  const indexBuilder = new IndexBuilder(INDEX_DB_CONFIG);
  await indexBuilder.initialize();
  console.log('IndexBuilder initialized');
  console.log('');

  let successCount = 0;
  let failCount = 0;
  const failures: { bookId: string; title: string; error: string }[] = [];

  for (const book of books) {
    console.log(`Processing: ${book.title || 'Untitled'} (${book.id})`);
    const startTime = Date.now();

    try {
      let content: string;

      if (book.content) {
        content = book.content;
      } else if (book.fileName) {
        const filePath = path.join(
          process.env.BOOKS_DIR || 'uploads/books',
          book.fileName
        );

        if (fs.existsSync(filePath)) {
          content = fs.readFileSync(filePath, 'utf-8');
        } else {
          throw new Error(`File not found: ${filePath}`);
        }
      } else {
        throw new Error('No content or fileName available');
      }

      if (!content || content.trim().length === 0) {
        throw new Error('Content is empty');
      }

      const chapters = fileParserService.extractChapters(content);
      console.log(`  Extracted ${chapters.length} chapters`);

      if (chapters.length === 0) {
        chapters.push({ chapter: 'Full Content', content });
      }

      const documents = createDocumentsFromChapters(
        book.id,
        book.title || 'Unknown',
        chapters.map(c => ({ title: c.chapter, content: c.content }))
      );
      console.log(`  Created ${documents.length} documents`);

      try {
        const existingIndex = await indexBuilder.loadIndex();
        await indexBuilder.deleteByBookId(existingIndex, book.id);
        console.log(`  Deleted existing index`);
      } catch {
        // Index might not exist yet
      }

      await indexBuilder.buildIndex(documents);
      console.log(`  Index built successfully`);

      const elapsed = Date.now() - startTime;
      console.log(`  Completed in ${elapsed}ms`);
      console.log('');
      successCount++;
    } catch (error: any) {
      console.error(`  ERROR: ${error.message}`);
      console.log('');
      failCount++;
      failures.push({
        bookId: book.id,
        title: book.title || 'Unknown',
        error: error.message,
      });
    }
  }

  console.log('=== Reindex Complete ===');
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('');

  if (failures.length > 0) {
    console.log('Failed books:');
    for (const f of failures) {
      console.log(`  - ${f.title} (${f.bookId}): ${f.error}`);
    }
  }
}

reindexAllBooks()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
