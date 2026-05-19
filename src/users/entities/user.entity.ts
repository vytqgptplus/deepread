import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { Book } from '../../books/entities/book.entity';

/**
 * User entity representing application users.
 * Stores authentication and profile information.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ nullable: true })
  name: string;

  @Column({ name: 'refresh_token', type: 'varchar', nullable: true })
  refreshToken: string | null;

  @Column({ name: 'refresh_token_exp', type: 'timestamp', nullable: true })
  refreshTokenExp: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Conversation, (conversation) => conversation.user)
  conversations: Conversation[];

  @OneToMany(() => Book, (book) => book.user)
  books: Book[];
}
