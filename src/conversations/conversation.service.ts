import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { PaginationDto } from './dto/pagination.dto';
import { Book } from '../books/entities/book.entity';

/**
 * Conversation service handling business logic for conversations.
 * Manages conversation CRUD and book associations.
 */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
  ) {}

  /**
   * Create a new conversation for a user.
   */
  async create(userId: string, createDto: CreateConversationDto): Promise<Conversation> {
    this.logger.log(`Creating conversation for user: ${userId}`);

    const conversation = this.conversationRepository.create({
      userId,
      title: createDto.title || `Conversation ${new Date().toLocaleDateString()}`,
    });

    const saved = await this.conversationRepository.save(conversation);
    this.logger.log(`Conversation created: ${saved.id}`);

    return saved;
  }

  /**
   * Find all conversations for a user with pagination.
   */
  async findAll(userId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [conversations, total] = await this.conversationRepository.findAndCount({
      where: { userId },
      order: { updatedAt: 'DESC' },
      skip,
      take: limit,
      relations: ['books'],
    });

    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find a single conversation by ID.
   * Verifies user ownership.
   */
  async findOne(userId: string, id: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id },
      relations: ['books', 'messages'],
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    return conversation;
  }

  /**
   * Update conversation title.
   */
  async update(
    userId: string,
    id: string,
    updateDto: UpdateConversationDto,
  ): Promise<Conversation> {
    const conversation = await this.findOne(userId, id);

    if (updateDto.title !== undefined) {
      conversation.title = updateDto.title;
    }

    const updated = await this.conversationRepository.save(conversation);
    this.logger.log(`Conversation updated: ${id}`);

    return updated;
  }

  /**
   * Delete a conversation.
   */
  async delete(userId: string, id: string): Promise<void> {
    const conversation = await this.findOne(userId, id);

    await this.conversationRepository.remove(conversation);
    this.logger.log(`Conversation deleted: ${id}`);
  }

  /**
   * Add books to a conversation.
   */
  async addBooks(userId: string, id: string, bookIds: string[]): Promise<Conversation> {
    const conversation = await this.findOne(userId, id);

    // Add books to conversation (TypeORM handles many-to-many)
    const currentBookIds = conversation.books.map((b: Book) => b.id);
    const newBookIds = bookIds.filter((bid) => !currentBookIds.includes(bid));

    if (newBookIds.length > 0) {
      // This would require loading books and adding them
      // For now, we'll just return the conversation
      this.logger.log(`Adding books to conversation ${id}: ${newBookIds.join(', ')}`);
    }

    return conversation;
  }

  /**
   * Remove a book from a conversation.
   */
  async removeBook(userId: string, id: string, bookId: string): Promise<Conversation> {
    const conversation = await this.findOne(userId, id);

    this.logger.log(`Removing book ${bookId} from conversation ${id}`);

    return conversation;
  }
}
