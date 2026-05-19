import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from '../books/entities/book.entity';
import { RagService } from './rag.service';
import { FileParserService } from '../books/services/file-parser.service';

/**
 * RAG Module - Retrieval Augmented Generation
 * 
 * Uses LlamaIndex.TS with PGVectorStore:
 * - HuggingFace local embedding (free, privacy-preserving)
 * - pgvector for vector storage and search
 * - SentenceSplitter for semantic chunking
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Book]),
  ],
  providers: [
    RagService,
    FileParserService,
  ],
  exports: [RagService],
})
export class RagModule {}
