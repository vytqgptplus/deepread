import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Book } from './entities/book.entity';
import { BookChunk } from '../rag/entities/book-chunk.entity';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { MinioProvider } from './providers/minio.provider';
import { FileParserService } from './services/file-parser.service';
import { RagModule } from '../rag/rag.module';

/**
 * Books module handling book upload, storage, and processing.
 * Integrates with MinIO for file storage and RAG for content indexing.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Book, BookChunk]),
    MulterModule.register({
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    }),
    forwardRef(() => RagModule),
  ],
  controllers: [BooksController],
  providers: [BooksService, MinioProvider, FileParserService],
  exports: [BooksService],
})
export class BooksModule {}
