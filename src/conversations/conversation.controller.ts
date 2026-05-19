import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { PaginationDto } from './dto/pagination.dto';
import { AddBooksDto } from './dto/add-books.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(private readonly conversationService: ConversationService) {}

  /**
   * Create a new conversation.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({ status: 201, description: 'Conversation created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() createDto: CreateConversationDto,
  ) {
    this.logger.log(`Creating conversation for user: ${userId}`);
    return this.conversationService.create(userId, createDto);
  }

  /**
   * Get all conversations for the current user.
   */
  @Get()
  @ApiOperation({ summary: 'Get all conversations' })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    this.logger.log(`Getting conversations for user: ${userId}`);
    return this.conversationService.findAll(userId, pagination);
  }

  /**
   * Get a single conversation by ID.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get conversation by ID' })
  @ApiResponse({ status: 200, description: 'Conversation details' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    this.logger.log(`Getting conversation: ${id}`);
    return this.conversationService.findOne(userId, id);
  }

  /**
   * Update conversation title.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update conversation' })
  @ApiResponse({ status: 200, description: 'Conversation updated' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateConversationDto,
  ) {
    this.logger.log(`Updating conversation: ${id}`);
    return this.conversationService.update(userId, id, updateDto);
  }

  /**
   * Delete a conversation.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete conversation' })
  @ApiResponse({ status: 204, description: 'Conversation deleted' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async delete(@CurrentUser('id') userId: string, @Param('id') id: string) {
    this.logger.log(`Deleting conversation: ${id}`);
    await this.conversationService.delete(userId, id);
  }

  /**
   * Add books to a conversation.
   */
  @Post(':id/books')
  @ApiOperation({ summary: 'Add books to conversation' })
  @ApiResponse({ status: 200, description: 'Books added successfully' })
  async addBooks(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() addBooksDto: AddBooksDto,
  ) {
    this.logger.log(`Adding books to conversation: ${id}`);
    return this.conversationService.addBooks(userId, id, addBooksDto.bookIds);
  }

  /**
   * Remove a book from a conversation.
   */
  @Delete(':id/books/:bookId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove book from conversation' })
  @ApiResponse({ status: 204, description: 'Book removed successfully' })
  async removeBook(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Param('bookId') bookId: string,
  ) {
    this.logger.log(`Removing book from conversation: ${id}`);
    await this.conversationService.removeBook(userId, id, bookId);
  }
}
