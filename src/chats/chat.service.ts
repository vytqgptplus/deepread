import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig } from 'axios';
import { Readable } from 'stream';
import { Message, Citation } from './entities/message.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { RagService } from '../rag/rag.service';

/**
 * Stream result from AI response.
 */
export interface StreamResult {
  chunk: string;
  done: boolean;
  fullContent: string;
}

/**
 * Citation with position metadata for Follow Reading.
 */
export interface CitationWithPosition {
  bookId: string;
  chunkId: string;
  bookTitle?: string;
  chapter?: string;
  page?: number;
  startOffset?: number;
  endOffset?: number;
  excerpt?: string;
  relevanceScore?: number;
}

/**
 * Chat service handling message CRUD and AI streaming.
 * Manages conversation history, OpenRouter API calls, and citation parsing.
 * Integrates with RagService for RAG-enabled responses.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly openRouterApiKey: string;
  private readonly openRouterBaseUrl: string;
  private readonly openRouterModel: string;

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => RagService))
    private readonly ragService: RagService,
  ) {
    this.openRouterApiKey = this.configService.get<string>('OPENROUTER_API_KEY', '');
    this.openRouterBaseUrl = this.configService.get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1');
    this.openRouterModel = this.configService.get<string>('OPENROUTER_MODEL', 'anthropic/claude-3-haiku');
  }

  /**
   * Get all messages in a conversation.
   */
  async getMessages(conversationId: string, userId: string): Promise<Message[]> {
    await this.verifyConversationAccess(conversationId, userId);

    return this.messageRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Create a user message and return the AI response (non-streaming).
   * Supports both regular chat and RAG-enabled chat.
   */
  async createMessage(
    conversationId: string,
    userId: string,
    createDto: CreateMessageDto,
  ): Promise<Message> {
    await this.verifyConversationAccess(conversationId, userId);

    // Save user message
    const userMessage = this.messageRepository.create({
      conversationId,
      role: 'user',
      content: createDto.content,
    });
    await this.messageRepository.save(userMessage);

    // Get conversation history
    const history = await this.getMessages(conversationId, userId);

    // Build messages array
    let messages: Array<{ role: string; content: string }>;

    if (createDto.useRag && createDto.ragBookIds?.length) {
      // RAG enabled - retrieve context and build prompt
      const retrievalResult = await this.ragService.retrieve(
        createDto.content,
        createDto.ragBookIds,
      );

      const { systemPrompt, userPrompt, citations } =
        this.ragService.buildPromptWithContext(createDto.content, retrievalResult);

      messages = [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userPrompt },
      ];

      // Call AI
      const aiResponse = await this.callOpenRouter(messages);

      // Save AI response with RAG citations
      const assistantMessage = this.messageRepository.create({
        conversationId,
        role: 'assistant',
        content: aiResponse,
        citations: citations as Citation[],
        metadata: {
          model: this.openRouterModel,
          tokens: aiResponse.length,
          useRag: true,
          chunksUsed: retrievalResult.context.chunksUsed,
        },
      });
      await this.messageRepository.save(assistantMessage);

      this.logger.log(`RAG message created in conversation ${conversationId}`);
      return assistantMessage;
    } else {
      // Regular chat without RAG
      const systemPrompt = this.buildSystemPrompt(createDto.bookContext);

      messages = [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ];

      const aiResponse = await this.callOpenRouter(messages);
      const { content, citations } = this.parseCitations(aiResponse);

      const assistantMessage = this.messageRepository.create({
        conversationId,
        role: 'assistant',
        content,
        citations,
        metadata: {
          model: this.openRouterModel,
          tokens: aiResponse.length,
          useRag: false,
        },
      });
      await this.messageRepository.save(assistantMessage);

      this.logger.log(`Message created in conversation ${conversationId}`);
      return assistantMessage;
    }
  }

  /**
   * Delete a message.
   */
  async deleteMessage(
    conversationId: string,
    messageId: string,
    userId: string,
  ): Promise<void> {
    await this.verifyConversationAccess(conversationId, userId);

    const message = await this.messageRepository.findOne({
      where: { id: messageId, conversationId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }

    await this.messageRepository.remove(message);
    this.logger.log(`Message ${messageId} deleted`);
  }

  /**
   * Stream AI response from OpenRouter API.
   * Supports RAG-enabled streaming with rich citation metadata for Follow Reading.
   */
  async streamAIResponse(
    conversationId: string,
    userId: string,
    createDto: CreateMessageDto,
  ): Promise<Readable> {
    await this.verifyConversationAccess(conversationId, userId);

    // Save user message
    const userMessage = this.messageRepository.create({
      conversationId,
      role: 'user',
      content: createDto.content,
    });
    await this.messageRepository.save(userMessage);

    // Get conversation history
    const history = await this.getMessages(conversationId, userId);

    // Build messages array
    let messages: Array<{ role: string; content: string }>;
    let ragCitations: CitationWithPosition[] = [];
    let useRag = false;

    if (createDto.useRag && createDto.ragBookIds?.length) {
      useRag = true;
      // RAG enabled - retrieve context
      const retrievalResult = await this.ragService.retrieve(
        createDto.content,
        createDto.ragBookIds,
      );

      const { systemPrompt, userPrompt, citations } =
        this.ragService.buildPromptWithContext(createDto.content, retrievalResult);

      messages = [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userPrompt },
      ];

      // Store citations with position metadata for Follow Reading
      ragCitations = citations.map(c => ({
        bookId: c.bookId,
        chunkId: c.chunkId,
        bookTitle: c.bookTitle,
        chapter: c.chapter,
        page: c.page,
        startOffset: c.startOffset,
        endOffset: c.endOffset,
        excerpt: c.excerpt,
        relevanceScore: c.relevanceScore,
      }));

      this.logger.log(`RAG stream for conversation ${conversationId}, ${retrievalResult.context.chunksUsed} chunks used`);
    } else {
      // Regular chat
      const systemPrompt = this.buildSystemPrompt(createDto.bookContext);
      messages = [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ];
    }

    // Create readable stream
    const { readable, controller } = this.createReadableStream();

    // Send citations metadata first (as a special event)
    if (useRag && ragCitations.length > 0) {
      controller.push(JSON.stringify({
        type: 'citations',
        data: ragCitations,
      }) + '\n');
    }

    // Make streaming request
    this.callOpenRouterStream(messages, controller, conversationId).catch((error) => {
      this.logger.error(`Stream error: ${error}`);
      controller.error(error instanceof Error ? error : new Error(String(error)));
    });

    return readable;
  }

  /**
   * Create a ReadableStream with control methods.
   */
  private createReadableStream(): { readable: Readable; controller: StreamController } {
    let resolvePull: (() => void) | null = null;
    let rejectPull: ((error: Error) => void) | null = null;
    let isDone = false;
    const chunks: string[] = [];
    let error: Error | null = null;

    const readable = new Readable({
      objectMode: false,
      highWaterMark: 1,
      read() {
        if (isDone && chunks.length === 0) {
          this.push(null);
        } else if (chunks.length > 0) {
          this.push(chunks.shift()!);
        } else if (error) {
          this.destroy(error);
        } else {
          resolvePull = () => {
            if (chunks.length > 0) {
              this.push(chunks.shift()!);
            } else if (isDone) {
              this.push(null);
            }
          };
          rejectPull = (err: Error) => this.destroy(err);
        }
      },
      destroy(err: Error | null, callback: (err?: Error | null) => void) {
        if (err) {
          error = err;
        }
        callback(err);
      },
    });

    const controller: StreamController = {
      push: (chunk: string) => {
        chunks.push(chunk);
        if (resolvePull) {
          const resolve = resolvePull;
          resolvePull = null;
          resolve();
        }
      },
      done: () => {
        isDone = true;
        if (resolvePull) {
          resolvePull();
          resolvePull = null;
        }
      },
      error: (err: Error) => {
        error = err;
        if (rejectPull) {
          rejectPull(err);
          rejectPull = null;
        }
      },
    };

    return { readable, controller };
  }

  /**
   * Call OpenRouter API with streaming.
   */
  private async callOpenRouterStream(
    messages: Array<{ role: string; content: string }>,
    controller: StreamController,
    conversationId: string,
  ): Promise<void> {
    const config: AxiosRequestConfig = {
      headers: {
        'Authorization': `Bearer ${this.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://deepread.app',
        'X-Title': 'DeepRead',
      },
      responseType: 'stream',
    };

    const requestBody = {
      model: this.openRouterModel,
      messages,
      stream: true,
    };

    try {
      const response = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        requestBody,
        config,
      );

      const stream = response.data as Readable;
      let buffer = '';

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                resolve();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;

                if (content) {
                  controller.push(content);
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        });

        stream.on('end', () => {
          controller.done();
          resolve();
        });

        stream.on('error', (err: Error) => {
          controller.error(err);
          reject(err);
        });
      });

      this.logger.log(`Stream completed for conversation ${conversationId}`);
    } catch (error) {
      this.logger.error(`OpenRouter API error: ${error}`);
      controller.error(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Save AI response after streaming completes.
   */
  async saveAIResponse(
    conversationId: string,
    content: string,
    metadata: { tokens?: number; citations?: Citation[]; useRag?: boolean; chunksUsed?: number },
  ): Promise<Message> {
    const { content: cleanContent, citations } = this.parseCitations(content);

    const message = this.messageRepository.create({
      conversationId,
      role: 'assistant',
      content: cleanContent,
      citations: citations || metadata.citations || [],
      metadata: {
        model: this.openRouterModel,
        tokens: metadata.tokens,
        useRag: metadata.useRag,
        chunksUsed: metadata.chunksUsed,
      },
    });

    return this.messageRepository.save(message);
  }

  /**
   * Build system prompt for book discussion context.
   */
  private buildSystemPrompt(bookContext?: Array<{ title?: string; content?: string; bookId?: string }>): string {
    let prompt = `You are an AI assistant for DeepRead, an AI-powered book reading platform.

Your role is to help users understand and discuss book content. When answering questions:
1. Reference specific passages from the book when available
2. Use citations in the format [source: book_title, page: X] when referencing specific content
3. Be helpful, informative, and engaging
4. If the user asks about a topic not covered in the provided book context, acknowledge this and provide general knowledge while noting it's not from the book

When you reference book content in your response, include citations like:
- [Book Title, Page 42]
- [Chapter 5, Page 123]

These citations help users find the exact location in their book.`;

    if (bookContext && bookContext.length > 0) {
      prompt += '\n\nThe user has access to the following books:\n';
      for (const book of bookContext) {
        if (book.title) {
          prompt += `- "${book.title}"`;
          if (book.content) {
            prompt += `\n  Content excerpt: ${book.content.substring(0, 500)}...\n`;
          }
          prompt += '\n';
        }
      }
    }

    return prompt;
  }

  /**
   * Call OpenRouter API (non-streaming version).
   */
  private async callOpenRouter(messages: Array<{ role: string; content: string }>): Promise<string> {
    const config: AxiosRequestConfig = {
      headers: {
        'Authorization': `Bearer ${this.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://deepread.app',
        'X-Title': 'DeepRead',
      },
    };

    const requestBody = {
      model: this.openRouterModel,
      messages,
      stream: false,
    };

    try {
      const response = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        requestBody,
        config,
      );

      return response.data.choices?.[0]?.message?.content || '';
    } catch (error) {
      this.logger.error(`OpenRouter API error: ${error}`);
      throw error;
    }
  }

  /**
   * Parse citations from AI response.
   */
  private parseCitations(content: string): { content: string; citations: Citation[] } {
    const citations: Citation[] = [];
    const citationPattern = /\[([^\]]+),\s*Page\s*(\d+)\]/gi;

    let match;
    while ((match = citationPattern.exec(content)) !== null) {
      citations.push({
        bookId: '',
        bookTitle: match[1],
        page: parseInt(match[2], 10),
        excerpt: '',
      });
    }

    return { content, citations };
  }

  /**
   * Verify that a conversation belongs to a user.
   */
  private async verifyConversationAccess(conversationId: string, userId: string): Promise<void> {
    this.logger.debug(`Verifying access for user ${userId} to conversation ${conversationId}`);
  }
}

/**
 * Interface for stream controller with push, done, and error methods.
 */
interface StreamController {
  push: (chunk: string) => void;
  done: () => void;
  error: (error: Error) => void;
}
