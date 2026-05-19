import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './gateways/chat.gateway';
import { ConversationModule } from '../conversations/conversation.module';
import { RagModule } from '../rag/rag.module';

/**
 * Chat module handling messages and AI streaming.
 * Core module for AI-powered book discussions with SSE streaming support.
 * Integrates with RagModule for RAG-enabled responses.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    ConversationModule,
    forwardRef(() => RagModule),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
