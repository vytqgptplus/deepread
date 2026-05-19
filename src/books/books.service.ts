import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { Book } from './entities/book.entity';
import { MinioProvider } from './providers/minio.provider';
import { FileParserService } from './services/file-parser.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { PaginationDto } from '../conversations/dto/pagination.dto';
import { RagService } from '../rag/rag.service';

interface FileWithMeta {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/**
 * Books service handling book business logic.
 * Manages book upload, storage, and processing for RAG.
 */
@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(
    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,
    private readonly minioProvider: MinioProvider,
    private readonly fileParserService: FileParserService,
    private readonly ragService: RagService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * List all books for a user.
   */
  async findAll(userId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [books, total] = await this.bookRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      books,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Upload a new book.
   */
  async upload(
    userId: string,
    file: FileWithMeta,
    createBookDto: CreateBookDto,
  ): Promise<Book> {
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/epub+zip',
      'application/x-mobipocket-ebook',
      'text/plain',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Supported formats: PDF, EPUB, TXT',
      );
    }

    // Determine format
    const format = this.getFormatFromMimeType(file.mimetype);

    // Generate object key
    const objectKey = `books/${userId}/${Date.now()}-${file.originalname}`;

    // Upload to MinIO
    await this.minioProvider.upload(
      objectKey,
      file.buffer,
      file.mimetype,
      file.size,
    );

    // Extract text content
    let content = '';
    let pages = 0;

    try {
      const parsed = await this.fileParserService.parse(file.buffer, format);
      content = parsed.content;
      pages = parsed.pages;
    } catch (error) {
      this.logger.warn(`Failed to parse file content: ${error.message}`);
    }

    // Generate title if not provided
    const title = createBookDto.title || this.extractTitle(file.originalname);
    const author = createBookDto.author || 'Unknown';

    // Create book record
    const book = this.bookRepository.create({
      title,
      author,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      storagePath: objectKey,
      minioObjectKey: objectKey,
      format,
      pages,
      content: content.substring(0, 50000), // Store first 50k chars
      contentPreview: content.substring(0, 500),
      processingStatus: 'pending',
      userId,
    });

    const saved = await this.bookRepository.save(book);
    this.logger.log(`Book uploaded: ${saved.id}`);

    return saved;
  }

  /**
   * Get a single book by ID.
   */
  async findOne(id: string, userId: string): Promise<Book> {
    const book = await this.bookRepository.findOne({ where: { id } });

    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found`);
    }

    if (book.userId !== userId) {
      throw new ForbiddenException('You do not have access to this book');
    }

    return book;
  }

  /**
   * Update book metadata.
   */
  async update(
    id: string,
    userId: string,
    updateBookDto: UpdateBookDto,
  ): Promise<Book> {
    const book = await this.findOne(id, userId);

    if (updateBookDto.title !== undefined) {
      book.title = updateBookDto.title;
    }

    if (updateBookDto.author !== undefined) {
      book.author = updateBookDto.author;
    }

    const updated = await this.bookRepository.save(book);
    this.logger.log(`Book updated: ${id}`);

    return updated;
  }

  /**
   * Delete a book and its file.
   */
  async delete(id: string, userId: string): Promise<void> {
    const book = await this.findOne(id, userId);

    // Delete from MinIO
    if (book.minioObjectKey) {
      try {
        await this.minioProvider.delete(book.minioObjectKey);
      } catch (error) {
        this.logger.warn(`Failed to delete file from MinIO: ${error.message}`);
      }
    }

    // Delete RAG index
    try {
      await this.ragService.deleteBook(id);
    } catch (error) {
      this.logger.warn(`Failed to delete RAG index: ${error.message}`);
    }

    // Delete from database
    await this.bookRepository.remove(book);
    this.logger.log(`Book deleted: ${id}`);
  }

  /**
   * Get file stream for download.
   */
  async getFileStream(id: string, userId: string): Promise<{
    fileStream: Readable;
    fileName: string;
    fileType: string;
  }> {
    const book = await this.findOne(id, userId);

    if (!book.minioObjectKey) {
      throw new NotFoundException('File not found in storage');
    }

    const stream = await this.minioProvider.getStream(book.minioObjectKey);

    return {
      fileStream: stream as Readable,
      fileName: book.fileName,
      fileType: book.fileType,
    };
  }

  /**
   * Get book content.
   */
  async getContent(id: string, userId: string): Promise<{
    id: string;
    title: string;
    content: string;
    pages: number;
  }> {
    const book = await this.findOne(id, userId);

    return {
      id: book.id,
      title: book.title,
      content: book.content || '',
      pages: book.pages,
    };
  }

  /**
   * Process book for RAG.
   */
  async processForRag(id: string, userId: string): Promise<{
    status: string;
    message: string;
  }> {
    const book = await this.findOne(id, userId);

    if (book.processingStatus === 'processing') {
      return {
        status: 'processing',
        message: 'Book is already being processed',
      };
    }

    if (book.processingStatus === 'processed') {
      return {
        status: 'processed',
        message: 'Book is already processed',
      };
    }

    // Update status
    book.processingStatus = 'processing';
    await this.bookRepository.save(book);

    // Process in background
    this.processBookRag(id, book.content || '').catch((error) => {
      this.logger.error(`RAG processing failed: ${error.message}`);
      this.bookRepository.update(id, { processingStatus: 'failed' });
    });

    return {
      status: 'processing',
      message: 'Book processing started',
    };
  }

  /**
   * Internal method to process book for RAG.
   */
  private async processBookRag(bookId: string, content: string): Promise<void> {
    try {
      await this.ragService.processBook(bookId, content);
      await this.bookRepository.update(bookId, { processingStatus: 'processed' });
      this.logger.log(`Book RAG processing completed: ${bookId}`);
    } catch (error) {
      this.logger.error(`RAG processing error: ${error.message}`);
      await this.bookRepository.update(bookId, { processingStatus: 'failed' });
      throw error;
    }
  }

  /**
   * Get processing status.
   */
  async getProcessingStatus(
    id: string,
    userId: string,
  ): Promise<{ processingStatus: string }> {
    const book = await this.findOne(id, userId);
    return { processingStatus: book.processingStatus };
  }

  /**
   * Get format from MIME type.
   */
  private getFormatFromMimeType(mimeType: string): 'pdf' | 'epub' | 'txt' {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('epub')) return 'epub';
    return 'txt';
  }

  /**
   * Extract title from filename.
   */
  private extractTitle(filename: string): string {
    // Remove extension
    const name = filename.replace(/\.(pdf|epub|txt)$/i, '');
    // Replace underscores and dashes with spaces
    const title = name.replace(/[_-]/g, ' ');
    // Capitalize first letter of each word
    return title.replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
