/**
 * LlamaIndex Settings
 * 
 * Setup global settings for:
 * - Embedding model (HuggingFace local, multilingual)
 * - Node parser (SentenceSplitter with larger chunks)
 */

import { Settings } from 'llamaindex';
import { HuggingFaceEmbedding } from '@llamaindex/huggingface';
import { SentenceSplitter } from 'llamaindex';

/**
 * Initialize LlamaIndex settings.
 * Call this once during module initialization.
 */
export function initializeLlamaIndex(): void {
  // Configure embedding model - multilingual model for Vietnamese support
  Settings.embedModel = new HuggingFaceEmbedding({
    modelType: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
  });

  // Configure node parser - semantic chunking with larger chunks
  // Each chunk has enough context for semantic search
  Settings.nodeParser = new SentenceSplitter({
    chunkSize: 512,      // tokens (~2000 chars)
    chunkOverlap: 128,   // tokens (~500 chars)
  });

  Settings.chunkSize = 512;
  Settings.chunkOverlap = 128;
}
