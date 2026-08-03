/**
 * Embedding + simple vector search
 * Uses a lightweight hash-based embedding for zero-dependency semantic-ish search.
 * Can be swapped for real OpenAI / local embeddings later.
 */

export function simpleEmbed(text: string, dims = 64): number[] {
  const vec = new Array(dims).fill(0);
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
    }
    const idx = hash % dims;
    vec[idx] += 1;
    // also spread to neighbors for smoother vectors
    vec[(idx + 1) % dims] += 0.5;
    vec[(idx + dims - 1) % dims] += 0.3;
  }

  // L2 normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot; // already normalized
}

export interface VectorHit {
  id: string;
  score: number;
}

export class InMemoryVectorIndex {
  private items: { id: string; vector: number[] }[] = [];

  add(id: string, text: string) {
    this.items.push({ id, vector: simpleEmbed(text) });
  }

  addVector(id: string, vector: number[]) {
    this.items.push({ id, vector });
  }

  search(query: string, topK = 10): VectorHit[] {
    const q = simpleEmbed(query);
    const scored = this.items.map((item) => ({
      id: item.id,
      score: cosineSimilarity(q, item.vector),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).filter((h) => h.score > 0.05);
  }

  clear() {
    this.items = [];
  }

  size() {
    return this.items.length;
  }
}
