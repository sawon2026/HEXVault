/**
 * Multi-provider LLM registry with priority, fallback, and retries.
 */
import {
  createLLMProvider,
  type LLMProvider,
  type LLMProviderName,
  type LLMMessage,
  type LLMOptions,
  type LLMResponse,
  OpenAICompatibleProvider,
  RuleBasedProvider,
} from "./provider.js";
import { AppError } from "../errors/app-error.js";
import { log } from "../logging/logger.js";

export type ExtendedProviderName =
  | LLMProviderName
  | "gemini"
  | "openrouter"
  | "groq"
  | "mistral"
  | "deepseek"
  | "azure";

const logger = log.child("llm-registry");

function providerFromName(name: ExtendedProviderName, apiKey?: string): LLMProvider {
  const key = apiKey || process.env.HEXVAULT_API_KEY || "";

  switch (name) {
    case "openai":
    case "anthropic":
    case "grok":
    case "ollama":
    case "rule-based":
      return createLLMProvider(name as LLMProviderName, key);
    case "gemini":
      return new OpenAICompatibleProvider(
        "openai",
        key || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "",
        process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
        process.env.GEMINI_MODEL || "gemini-2.0-flash"
      );
    case "openrouter":
      return new OpenAICompatibleProvider(
        "openai",
        key || process.env.OPENROUTER_API_KEY || "",
        "https://openrouter.ai/api/v1",
        process.env.OPENROUTER_MODEL || "openrouter/auto"
      );
    case "groq":
      return new OpenAICompatibleProvider(
        "openai",
        key || process.env.GROQ_API_KEY || "",
        "https://api.groq.com/openai/v1",
        process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
      );
    case "mistral":
      return new OpenAICompatibleProvider(
        "openai",
        key || process.env.MISTRAL_API_KEY || "",
        "https://api.mistral.ai/v1",
        process.env.MISTRAL_MODEL || "mistral-small-latest"
      );
    case "deepseek":
      return new OpenAICompatibleProvider(
        "openai",
        key || process.env.DEEPSEEK_API_KEY || "",
        "https://api.deepseek.com/v1",
        process.env.DEEPSEEK_MODEL || "deepseek-chat"
      );
    case "azure":
      return new OpenAICompatibleProvider(
        "openai",
        key || process.env.AZURE_OPENAI_API_KEY || "",
        process.env.AZURE_OPENAI_ENDPOINT || "",
        process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini"
      );
    default:
      return new RuleBasedProvider();
  }
}

export interface RegistryOptions {
  priority?: ExtendedProviderName[];
  maxRetries?: number;
  retryDelayMs?: number;
}

export class LLMRegistry {
  private priority: ExtendedProviderName[];
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(opts: RegistryOptions = {}) {
    this.priority =
      opts.priority ||
      ((process.env.HEXVAULT_LLM_PRIORITY || "rule-based")
        .split(",")
        .map((s) => s.trim()) as ExtendedProviderName[]);
    this.maxRetries = opts.maxRetries ?? 2;
    this.retryDelayMs = opts.retryDelayMs ?? 400;
  }

  async complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    let lastError: unknown;

    for (const name of this.priority) {
      const provider = providerFromName(name);
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          logger.debug("Trying provider", { name, attempt });
          const res = await provider.complete(messages, options);
          if (res.content) return res;
        } catch (err) {
          lastError = err;
          logger.warn("Provider failed", {
            name,
            attempt,
            error: err instanceof Error ? err.message : String(err),
          });
          if (attempt < this.maxRetries) {
            await new Promise((r) => setTimeout(r, this.retryDelayMs * (attempt + 1)));
          }
        }
      }
    }

    const fallback = new RuleBasedProvider();
    try {
      return await fallback.complete(messages, options);
    } catch {
      throw new AppError("LLM_PROVIDER", "All LLM providers failed", {
        details: {
          lastError: lastError instanceof Error ? lastError.message : String(lastError),
        },
      });
    }
  }

  listConfigured(): ExtendedProviderName[] {
    return [...this.priority];
  }
}
