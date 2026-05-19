import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BookChunk } from './book-chunk.entity';

/**
 * ChunkEmbedding entity storing vector embeddings for semantic search.
 * Uses pgvector for efficient vector storage and similarity search.
 */
@Entity('chunk_embeddings')
@Index(['chunkId'])
export class ChunkEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'chunk_id' })
  chunkId: string;

  @OneToOne(() => BookChunk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chunk_id' })
  chunk: BookChunk;

  /**
   * Vector embedding stored as a JSON array.
   * For pgvector, this would be a native VECTOR type.
   * For compatibility, we store as a JSON array of floats.
   */
  @Column({ type: 'jsonb' })
  embedding: number[];

  /**
   * Original text content for BM25 keyword search.
   */
  @Column({ type: 'text', nullable: true })
  content: string;

  /**
   * Metadata about the embedding (model used, dimensions, etc.)
   */
  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
