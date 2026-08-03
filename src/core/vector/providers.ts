/**
 * Embedding providers — local hash (default) + OpenAI-compatible real embeddings.
 */
import { simpleEmbed } from "./embeddings.js";
import { log } from "../logging/logger.js";

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  embedBatch?(texts: string[]): Promise<number[][]>;
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local";
  readonly dimensions: number;

  constructor(dims = 64) {
    this.dimensions = dims;
  }

  async embed(text: string): Promise<number[]> {
    return simpleEmbed(text, this.dimensions);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => simpleEmbed(t, this.dimensions));
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly dimensions: number;
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private logger = log.child("embed-openai");

  constructor(opts?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    dimensions?: number;
  }) {
    this.apiKey =
      opts?.apiKey ||
      process.env.OPENAI_API_KEY ||
      process.env.HEXVAULT_API_KEY ||
      "";
    this.baseUrl = (
      opts?.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
    ).replace(/\/$/, "");
    this.model =
      opts?.model || process.env.HEXVAULT_EMBED_MODEL || "text-embedding-3-small";
    this.dimensions =
      opts?.dimensions || Number(process.env.HEXVAULT_EMBED_DIMS || 1536);
  }

  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) {
      this.logger.warn("No API key — falling back to local embeddings");
      return simpleEmbed(text, 64);
    }

    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: text.slice(0, 8000),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.warn("OpenAI embed failed — local fallback", {
        status: res.status,
        body: body.slice(0, 200),
      });
      return simpleEmbed(text, 64);
    }

    const data = (await res.json()) as { data?: { embedding: number[] }[] };
    const vec = data.data?.[0]?.embedding;
    if (!vec?.length) return simpleEmbed(text, 64);
    return vec;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      return texts.map((t) => simpleEmbed(t, 64));
    }
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: texts.map((t) => t.slice(0, 8000)),
      }),
    });
    if (!res.ok) {
      return texts.map((t) => simpleEmbed(t, 64));
    }
    const data = (await res.json()) as {
      data?: { embedding: number[]; index: number }[];
    };
    const rows = data.data || [];
    rows.sort((a, b) => a.index - b.index);
    return rows.map((r) => r.embedding);
  }
}

export type EmbeddingProviderName = "local" | "openai";

export function createEmbeddingProvider(
  name?: EmbeddingProviderName
): EmbeddingProvider {
  const n = (name ||
    process.env.HEXVAULT_EMBED_PROVIDER ||
    "local") as EmbeddingProviderName;
  if (n === "openai") return new OpenAIEmbeddingProvider();
  return new LocalEmbeddingProvider();
}
