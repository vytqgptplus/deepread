import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateMessageDto } from './dto/create-message.dto';
import { Message } from './entities/message.entity';

/**
 * Chat controller handling message operations and SSE streaming.
 * Provides both REST endpoints for messages and SSE endpoint for streaming.
 */
@ApiTags('Chats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  /**
   * Stream AI response using Server-Sent Events (SSE).
   * 
   * Workflow:
   * 1. Client sends POST request with message content
   * 2. Server creates a user message in the database
   * 3. Server calls OpenRouter API with streaming enabled
   * 4. Server streams AI response chunks via SSE
   * 5. Server saves the complete AI response to database
   * 6. Client receives 'done' event when streaming completes
   * 
   * SSE Event Format:
   * - event: chunk - Contains text chunk: data: {"chunk": "..."}
   * - event: done - Streaming complete: data: {"messageId": "...", "citations": [...]}
   * - event: error - Error occurred: data: {"error": "..."}
   */
  @Post(':conversationId/stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stream AI response with SSE' })
  @ApiResponse({ status: 200, description: 'SSE stream established' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiConsumes('application/json')
  async streamChat(
    @Param('conversationId') conversationId: string,
    @Body() createDto: CreateMessageDto,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ) {
    const userId = user.id;
    this.logger.log(`SSE stream request for conversation ${conversationId}`);

    try {
      // Get the streaming response from ChatService
      const stream = await this.chatService.streamAIResponse(
        conversationId,
        userId,
        createDto,
      );

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      // Collect full content for saving
      let fullContent = '';

      // Pipe the stream to the response with SSE formatting
      stream.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        fullContent += text;
        
        // Format as SSE event
        const data = JSON.stringify({ chunk: text });
        res.write(`event: chunk\ndata: ${data}\n\n`);
      });

      stream.on('end', async () => {
        this.logger.log(`Stream ended for conversation ${conversationId}`);

        // Save the complete AI response
        if (fullContent) {
          try {
            const savedMessage = await this.chatService.saveAIResponse(
              conversationId,
              fullContent,
              { tokens: fullContent.length },
            );

            // Send done event
            const doneData = JSON.stringify({
              messageId: savedMessage.id,
              citations: savedMessage.citations,
            });
            res.write(`event: done\ndata: ${doneData}\n\n`);
          } catch (error) {
            this.logger.error(`Failed to save AI response: ${error}`);
            const errorData = JSON.stringify({ error: 'Failed to save response' });
            res.write(`event: error\ndata: ${errorData}\n\n`);
          }
        }

        res.end();
      });

      stream.on('error', (error: Error) => {
        this.logger.error(`Stream error: ${error.message}`);
        const errorData = JSON.stringify({ error: error.message });
        res.write(`event: error\ndata: ${errorData}\n\n`);
        res.end();
      });

    } catch (error) {
      this.logger.error(`SSE setup error: ${error}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to start stream',
      });
    }
  }

  /**
   * Get all messages in a conversation.
   */
  @Get(':conversationId/messages')
  @ApiOperation({ summary: 'Get all messages in a conversation' })
  @ApiResponse({ status: 200, description: 'List of messages' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMessages(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: { id: string },
  ): Promise<Message[]> {
    return this.chatService.getMessages(conversationId, user.id);
  }

  /**
   * Send a message and get AI response (non-streaming version).
   * Use POST /chats/:conversationId/stream for streaming responses.
   */
  @Post(':conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message (non-streaming)' })
  @ApiResponse({ status: 201, description: 'Message sent and AI response received' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() createDto: CreateMessageDto,
    @CurrentUser() user: { id: string },
  ): Promise<Message> {
    return this.chatService.createMessage(conversationId, user.id, createDto);
  }

  /**
   * Delete a message from a conversation.
   */
  @Delete(':conversationId/messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a message' })
  @ApiResponse({ status: 204, description: 'Message deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async deleteMessage(
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    await this.chatService.deleteMessage(conversationId, messageId, user.id);
  }
}
