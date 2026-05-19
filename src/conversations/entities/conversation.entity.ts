import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Book } from '../../books/entities/book.entity';
import { Message } from '../../chats/entities/message.entity';

/**
 * Conversation entity representing a chat session about books.
 * Contains multiple messages and can reference multiple books.
 */
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.conversations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  title: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Messages in this conversation
  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  // Books associated with this conversation
  @ManyToMany(() => Book, (book) => book.conversations)
  @JoinTable({
    name: 'conversation_books',
    joinColumn: { name: 'conversation_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'book_id', referencedColumnName: 'id' },
  })
  books: Book[];
}
