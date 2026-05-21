import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Conversation } from '../../conversations/entities/conversation.entity';

/**
 * Citation format with position metadata for Follow Reading.
 * AI includes these when referencing book content.
 */
export interface Citation {
  bookId?: string;
  chunkId?: string;
  bookTitle?: string;
  page?: number;
  chapter?: string;
  startOffset?: number;
  endOffset?: number;
  excerpt?: string;
  relevanceScore?: number;
}

/**
 * Message metadata for tracking AI processing.
 */
export interface MessageMetadata {
  tokens?: number;
  model?: string;
  finishReason?: string;
  citations?: Citation[];
  useRag?: boolean;
  chunksUsed?: number;
}

/**
 * Message entity representing a single message in a conversation.
 * Supports both user messages and AI assistant responses.
 */
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({
    type: 'enum',
    enum: ['user', 'assistant', 'system'],
    default: 'user',
  })
  role: 'user' | 'assistant' | 'system';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', default: [] })
  citations: Citation[];

  @Column({ type: 'jsonb', default: {} })
  metadata: MessageMetadata;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
