import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { ConversationRepository } from './repositories/conversation.repository';

/**
 * Conversation module handling chat sessions.
 * Manages CRUD operations for conversations and their book associations.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Conversation])],
  controllers: [ConversationController],
  providers: [ConversationService, ConversationRepository],
  exports: [ConversationService],
})
export class ConversationModule {}
