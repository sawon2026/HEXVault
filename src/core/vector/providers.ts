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

/** Zero-dependency local provider (hash-based). Always available. */
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

/**
 * OpenAI-compatible embeddings (OpenAI, Azure, local servers that mirror /v1/embeddings).
 */
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
      opts?.baseUrl ||
      process.env.OPENAI_BASE_URL ||
      "https://api.openai.com/v1"
    ).replace(/\/$/, "");
    this.model =
      opts?.model ||
      process.env.HEXVAULT_EMBED_MODEL ||
      "text-embedding-3-small";
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

/** Ollama embeddings — local, free, OpenAI-shaped API. */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = "ollama";
  readonly dimensions: number;
  private baseUrl: string;
  private model: string;
  private logger = log.child("embed-ollama");

  constructor(opts?: {
    baseUrl?: string;
    model?: string;
    dimensions?: number;
  }) {
    this.baseUrl = (
      opts?.baseUrl ||
      process.env.OLLAMA_HOST ||
      "http://localhost:11434"
    ).replace(/\/$/, "");
    this.model =
      opts?.model || process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
    this.dimensions = opts?.dimensions || 768;
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt: text.slice(0, 8000) }),
    });
    if (!res.ok) {
      this.logger.warn("Ollama embed failed — local fallback", {
        status: res.status,
      });
      return simpleEmbed(text, 64);
    }
    const data = (await res.json()) as { embedding?: number[] };
    if (!data.embedding?.length) return simpleEmbed(text, 64);
    return data.embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (const t of texts) out.push(await this.embed(t));
    return out;
  }
}

export type EmbeddingProviderName = "local" | "openai" | "ollama";

/** Factory from env: HEXVAULT_EMBED_PROVIDER=local|openai|ollama */
export function createEmbeddingProvider(
  name?: EmbeddingProviderName,
): EmbeddingProvider {
  const n = (name ||
    process.env.HEXVAULT_EMBED_PROVIDER ||
    "local") as EmbeddingProviderName;
  if (n === "openai") return new OpenAIEmbeddingProvider();
  if (n === "ollama") return new OllamaEmbeddingProvider();
  return new LocalEmbeddingProvider();
}
