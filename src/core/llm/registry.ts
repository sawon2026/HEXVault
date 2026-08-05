/**
 * Multi-provider LLM registry with priority, fallback, jittered retries.
 *
 * Providers (Phase 5): OpenAI, Anthropic, Gemini, Ollama, LM Studio,
 * OpenRouter, Azure OpenAI, Groq, Mistral, DeepSeek, Grok + rule-based.
 *
 * Behavior:
 *  1. Tries configured providers in priority order.
 *  2. Each provider gets `maxRetries` attempts with exponential backoff + jitter.
 *  3. Falls back to the next provider on failure.
 *  4. Absolute fallback: RuleBasedProvider (never masquerades as an LLM).
 */
import {
  createLLMProvider,
  type LLMProvider,
  type LLMProviderName,
  type LLMMessage,
  type LLMOptions,
  type LLMResponse,
  RuleBasedProvider,
} from "./provider.js";
import { AppError } from "../errors/app-error.js";
import { log } from "../logging/logger.js";
import { providerStatus } from "../env/validate.js";

export type ExtendedProviderName = LLMProviderName;

const logger = log.child("llm-registry");

export const ALL_PROVIDERS: ExtendedProviderName[] = [
  "openai",
  "anthropic",
  "grok",
  "gemini",
  "ollama",
  "lmstudio",
  "openrouter",
  "azure",
  "groq",
  "mistral",
  "deepseek",
];

function providerFromName(
  name: ExtendedProviderName,
  apiKey?: string,
): LLMProvider {
  return createLLMProvider(name as LLMProviderName, apiKey);
}

export interface RegistryOptions {
  /** Ordered preference list */
  priority?: ExtendedProviderName[];
  maxRetries?: number;
  retryDelayMs?: number;
  /** Disable the rule-based absolute fallback (throws when all providers fail) */
  allowFallback?: boolean;
}

/** jittered backoff: base * 2^attempt + random 0..base */
function delayWithJitter(base: number, attempt: number): number {
  return Math.min(5000, base * 2 ** attempt) + Math.random() * base;
}

/**
 * Tries providers in priority order with retries.
 */
export class LLMRegistry {
  private priority: ExtendedProviderName[];
  private maxRetries: number;
  private retryDelayMs: number;
  private allowFallback: boolean;

  constructor(opts: RegistryOptions = {}) {
    this.priority = (opts.priority ||
      (process.env.HEXVAULT_LLM_PRIORITY || "rule-based")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)) as ExtendedProviderName[];
    this.maxRetries = opts.maxRetries ?? 2;
    this.retryDelayMs = opts.retryDelayMs ?? 400;
    this.allowFallback = opts.allowFallback !== false;
  }

  async complete(
    messages: LLMMessage[],
    options?: LLMOptions,
  ): Promise<LLMResponse> {
    let lastError: unknown;

    // Only real providers are tried; "rule-based" is reserved for the
    // absolute fallback so its canned output never masquerades as an LLM reply.
    const candidates = this.priority.filter((name) => name !== "rule-based");
    if (candidates.length === 0) {
      if (!this.allowFallback) {
        throw new AppError("LLM_PROVIDER", "No LLM providers configured");
      }
      return new RuleBasedProvider().complete(messages);
    }

    for (const name of candidates) {
      const provider = providerFromName(name);
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          logger.debug("Trying provider", { name, attempt });
          const res = await provider.complete(messages, options);
          if (res.content) return res;
          logger.warn("Provider returned empty content", { name, attempt });
        } catch (err) {
          lastError = err;
          logger.warn("Provider failed", {
            name,
            attempt,
            error: err instanceof Error ? err.message : String(err),
          });
          if (attempt < this.maxRetries) {
            await new Promise((r) =>
              setTimeout(r, delayWithJitter(this.retryDelayMs, attempt)),
            );
          }
        }
      }
    }

    if (!this.allowFallback) {
      throw new AppError("LLM_PROVIDER", "All LLM providers failed", {
        details: {
          lastError:
            lastError instanceof Error ? lastError.message : String(lastError),
        },
      });
    }

    // Absolute fallback
    const fallback = new RuleBasedProvider();
    try {
      return await fallback.complete(messages);
    } catch {
      throw new AppError("LLM_PROVIDER", "All LLM providers failed", {
        details: {
          lastError:
            lastError instanceof Error ? lastError.message : String(lastError),
        },
      });
    }
  }

  listConfigured(): ExtendedProviderName[] {
    return [...this.priority];
  }

  /** Which providers have credentials/hosts configured (for dashboards). */
  status(): Record<string, { configured: boolean; env: string }> {
    return providerStatus();
  }
}
