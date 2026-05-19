import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Conversation } from '../../conversations/entities/conversation.entity';

/**
 * Book entity representing an uploaded book.
 * Supports PDF and EPUB formats with MinIO storage.
 */
@Entity('books')
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  author: string;

  @Column({ name: 'file_name', nullable: true })
  fileName: string;

  @Column({ name: 'file_type', nullable: true })
  fileType: string;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize: number;

  @Column({ name: 'storage_path', nullable: true })
  storagePath: string;

  @Column({ name: 'minio_object_key', nullable: true })
  minioObjectKey: string;

  @Column({ type: 'int', nullable: true })
  pages: number;

  @Column({ name: 'content_preview', type: 'text', nullable: true })
  contentPreview: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({
    type: 'enum',
    enum: ['pdf', 'epub', 'txt'],
    default: 'pdf',
  })
  format: 'pdf' | 'epub' | 'txt';

  @Column({
    type: 'enum',
    enum: ['pending', 'processing', 'processed', 'failed'],
    default: 'pending',
  })
  processingStatus: 'pending' | 'processing' | 'processed' | 'failed';

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, (user) => user.books, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Many-to-many relationship with conversations
  @ManyToMany(() => Conversation, (conversation) => conversation.books)
  conversations: Conversation[];
}
