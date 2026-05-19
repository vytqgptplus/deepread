import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Book } from '../../books/entities/book.entity';

/**
 * BookChunk entity representing a chunk of book content.
 * Each chunk is a segment of text extracted from a book for RAG retrieval.
 */
@Entity('book_chunks')
@Index(['bookId'])
@Index(['chunkIndex'])
export class BookChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'book_id' })
  bookId: string;

  @ManyToOne(() => Book, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book: Book;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex: number;

  @Column({ nullable: true })
  chapter: string;

  @Column({ name: 'page_start', type: 'int', nullable: true })
  pageStart: number;

  @Column({ name: 'page_end', type: 'int', nullable: true })
  pageEnd: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'content_hash', nullable: true })
  contentHash: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
