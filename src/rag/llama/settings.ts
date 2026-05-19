/**
 * LlamaIndex Settings
 * 
 * Setup global settings for:
 * - Embedding model (HuggingFace local)
 * - Node parser (SentenceSplitter for semantic chunking)
 */

import { Settings } from 'llamaindex';
import { HuggingFaceEmbedding } from '@llamaindex/huggingface';
import { SentenceSplitter } from 'llamaindex';

/**
 * Initialize LlamaIndex settings.
 * Call this once during module initialization.
 */
export function initializeLlamaIndex(): void {
  // Configure embedding model - HuggingFace local (free, privacy-preserving)
  Settings.embedModel = new HuggingFaceEmbedding({
    modelType: 'Xenova/all-MiniLM-L6-v2',
  });

  // Configure node parser - semantic chunking
  Settings.nodeParser = new SentenceSplitter({
    chunkSize: 512,     // tokens (~2000 chars)
    chunkOverlap: 128, // tokens (~500 chars)
  });

  Settings.chunkSize = 512;
  Settings.chunkOverlap = 128;
}
