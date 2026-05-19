import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Logger,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { Readable } from 'stream';
import { BooksService } from './books.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { PaginationDto } from '../conversations/dto/pagination.dto';

/**
 * Books controller handling book CRUD and file operations.
 * Provides endpoints for upload, download, and content retrieval.
 */
@ApiTags('Books')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('books')
export class BooksController {
  private readonly logger = new Logger(BooksController.name);

  constructor(private readonly booksService: BooksService) {}

  /**
   * List all books for the current user.
   */
  @Get()
  @ApiOperation({ summary: 'List all books' })
  @ApiResponse({ status: 200, description: 'List of books' })
  async findAll(
    @CurrentUser() user: { id: string },
    @Query() pagination: PaginationDto,
  ) {
    this.logger.log(`Listing books for user: ${user.id}`);
    return this.booksService.findAll(user.id, pagination);
  }

  /**
   * Upload a new book.
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB max
    },
  }))
  @ApiOperation({ summary: 'Upload a book' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Book file (PDF, EPUB, TXT)',
        },
        title: { type: 'string', description: 'Book title (optional)' },
        author: { type: 'string', description: 'Author name (optional)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Book uploaded successfully' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: string },
    @Body() createBookDto: CreateBookDto,
  ) {
    this.logger.log(`Uploading book: ${file.originalname}`);
    return this.booksService.upload(user.id, file, createBookDto);
  }

  /**
   * Get a single book by ID.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get book by ID' })
  @ApiResponse({ status: 200, description: 'Book details' })
  @ApiResponse({ status: 404, description: 'Book not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    this.logger.log(`Getting book: ${id}`);
    return this.booksService.findOne(id, user.id);
  }

  /**
   * Update book metadata.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update book metadata' })
  @ApiResponse({ status: 200, description: 'Book updated' })
  @ApiResponse({ status: 404, description: 'Book not found' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() updateBookDto: UpdateBookDto,
  ) {
    this.logger.log(`Updating book: ${id}`);
    return this.booksService.update(id, user.id, updateBookDto);
  }

  /**
   * Delete a book and its file from storage.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a book' })
  @ApiResponse({ status: 204, description: 'Book deleted' })
  @ApiResponse({ status: 404, description: 'Book not found' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    this.logger.log(`Deleting book: ${id}`);
    await this.booksService.delete(id, user.id);
  }

  /**
   * Download book file.
   */
  @Get(':id/download')
  @ApiOperation({ summary: 'Download book file' })
  @ApiResponse({ status: 200, description: 'Book file stream' })
  @ApiResponse({ status: 404, description: 'Book not found' })
  async download(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ) {
    this.logger.log(`Downloading book: ${id}`);
    const { fileStream, fileName, fileType } = await this.booksService.getFileStream(id, user.id);

    res.set({
      'Content-Type': fileType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });

    // Pipe MinIO stream to response
    (fileStream as NodeJS.ReadableStream).pipe(res);
  }

  /**
   * Get book content for reader.
   */
  @Get(':id/content')
  @ApiOperation({ summary: 'Get book content' })
  @ApiResponse({ status: 200, description: 'Book content' })
  @ApiResponse({ status: 404, description: 'Book not found' })
  async getContent(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    this.logger.log(`Getting content for book: ${id}`);
    return this.booksService.getContent(id, user.id);
  }

  /**
   * Process book for RAG (create chunks and embeddings).
   */
  @Post(':id/process')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Process book for RAG' })
  @ApiResponse({ status: 202, description: 'Processing started' })
  @ApiResponse({ status: 400, description: 'Book already processed or processing' })
  async process(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    this.logger.log(`Processing book for RAG: ${id}`);
    return this.booksService.processForRag(id, user.id);
  }

  /**
   * Get processing status.
   */
  @Get(':id/status')
  @ApiOperation({ summary: 'Get book processing status' })
  @ApiResponse({ status: 200, description: 'Processing status' })
  async getStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.booksService.getProcessingStatus(id, user.id);
  }
}
