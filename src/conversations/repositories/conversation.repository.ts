import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../../conversations/entities/conversation.entity';

/**
 * Extended repository for Conversation entity.
 * Provides additional query methods for conversation operations.
 */
@Injectable()
export class ConversationRepository extends Repository<Conversation> {
  constructor(
    @InjectRepository(Conversation)
    repository: Repository<Conversation>,
  ) {
    super(
      repository.target,
      repository.manager,
      repository.queryRunner,
    );
  }
}
