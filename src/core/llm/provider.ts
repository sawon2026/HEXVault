/**
 * Unified LLM Provider Interface
 * Providers: OpenAI, Anthropic (native), Grok, Gemini, Ollama, LM Studio,
 * OpenRouter, Groq, Mistral, DeepSeek, Azure OpenAI, rule-based.
 *
 * All remote providers are OpenAI-compatible REST clients with:
 *  - request timeouts
 *  - streaming support (SSE)
 *  - optional response validation
 */
import { AppError } from "../errors/app-error.js";
import { log } from "../logging/logger.js";

const logger = log.child("llm-provider");

export type LLMProviderName =
  | "openai"
  | "anthropic"
  | "grok"
  | "ollama"
  | "lmstudio"
  | "gemini"
  | "openrouter"
  | "groq"
  | "mistral"
  | "deepseek"
  | "azure"
  | "rule-based";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Enable SSE streaming */
  stream?: boolean;
  /** Per-request timeout ms (default 60s) */
  timeoutMs?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  /** Provider name as reported */
  provider?: string;
  usage?: { promptTokens: number; completionTokens: number };
  streamed?: boolean;
}

export interface LLMProvider {
  name: LLMProviderName;
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
}

const DEFAULT_TIMEOUT_MS = 60_000;

/** Wait for a signal with timeout; throws AppError(LLM_TIMEOUT) */
function withTimeout(
  promise: Promise<Response>,
  ms: number,
  what: string,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new AppError("LLM_TIMEOUT", `LLM request timed out after ${ms}ms`, {
          details: { what },
        }),
      );
    }, ms);
    promise.then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** OpenAI-compatible provider (works with OpenAI, Grok, Groq, Mistral, DeepSeek, LM Studio, OpenRouter, many proxies) */
export class OpenAICompatibleProvider implements LLMProvider {
  name: LLMProviderName;
  protected apiKey: string;
  protected baseUrl: string;
  protected defaultModel: string;
  private timeoutMs: number;

  constructor(
    name: LLMProviderName,
    apiKey: string,
    baseUrl: string,
    defaultModel: string,
    opts?: { timeoutMs?: number },
  ) {
    this.name = name;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.defaultModel = defaultModel;
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Override point for providers with custom URL shapes (e.g. Azure). */
  protected chatCompletionsUrl(): string {
    return `${this.baseUrl}/chat/completions`;
  }

  async complete(
    messages: LLMMessage[],
    options: LLMOptions = {},
  ): Promise<LLMResponse> {
    const model = options.model || this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2048,
    };
    if (options.stream) body.stream = true;

    let res: Response;
    try {
      res = await withTimeout(
        fetch(this.chatCompletionsUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify(body),
        }),
        options.timeoutMs ?? this.timeoutMs,
        `${this.name} ${model}`,
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("LLM_PROVIDER", `${this.name} request failed`, {
        details: { error: err instanceof Error ? err.message : String(err) },
        cause: err,
      });
    }

    if (!res.ok) {
      const text = (await res.text()).slice(0, 500);
      throw new AppError(
        "LLM_PROVIDER",
        `${this.name} API error (${res.status})`,
        {
          details: { body: text, model },
          statusCode: res.status,
        },
      );
    }

    if (options.stream) {
      const content = await this.readStream(res, model);
      return { content, model, provider: this.name, streamed: true };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      content: data.choices?.[0]?.message?.content || "",
      model,
      provider: this.name,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
          }
        : undefined,
    };
  }

  /** Consume an SSE stream and concatenate deltas. */
  private async readStream(res: Response, _model: string): Promise<string> {
    const reader = res.body?.getReader();
    if (!reader) return "";
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") return content;
          try {
            const json = JSON.parse(payload) as {
              choices?: { delta?: { content?: string } }[];
            };
            content += json.choices?.[0]?.delta?.content || "";
          } catch {
            // ignore malformed keep-alive chunks
          }
        }
      }
      return content;
    } catch (err) {
      logger.warn("Stream interrupted", {
        error: err instanceof Error ? err.message : String(err),
      });
      return content;
    }
  }
}

/** Native Anthropic messages API (not OpenAI-compatible). */
export class AnthropicProvider implements LLMProvider {
  name: LLMProviderName = "anthropic";
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private timeoutMs: number;

  constructor(
    apiKey: string,
    opts?: { baseUrl?: string; model?: string; timeoutMs?: number },
  ) {
    this.apiKey = apiKey;
    this.baseUrl = (opts?.baseUrl || "https://api.anthropic.com/v1").replace(
      /\/$/,
      "",
    );
    this.defaultModel =
      opts?.model || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async complete(
    messages: LLMMessage[],
    options: LLMOptions = {},
  ): Promise<LLMResponse> {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n");
    const rest = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
    const model = options.model || this.defaultModel;

    let res: Response;
    try {
      res = await withTimeout(
        fetch(`${this.baseUrl}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
            ...(options.stream
              ? { "anthropic-beta": "streaming-2024-04-01" }
              : {}),
          },
          body: JSON.stringify({
            model,
            system: system || undefined,
            messages: rest,
            max_tokens: options.maxTokens ?? 2048,
            temperature: options.temperature ?? 0.3,
            stream: options.stream || false,
          }),
        }),
        options.timeoutMs ?? this.timeoutMs,
        `anthropic ${model}`,
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("LLM_PROVIDER", "anthropic request failed", {
        details: { error: err instanceof Error ? err.message : String(err) },
        cause: err,
      });
    }

    if (!res.ok) {
      const text = (await res.text()).slice(0, 500);
      throw new AppError(
        "LLM_PROVIDER",
        `anthropic API error (${res.status})`,
        {
          details: { body: text, model },
          statusCode: res.status,
        },
      );
    }

    if (options.stream) {
      const content = await this.readStream(res);
      return { content, model, provider: "anthropic", streamed: true };
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("");
    return {
      content: text,
      model,
      provider: "anthropic",
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens || 0,
            completionTokens: data.usage.output_tokens || 0,
          }
        : undefined,
    };
  }

  private async readStream(res: Response): Promise<string> {
    const reader = res.body?.getReader();
    if (!reader) return "";
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          try {
            const json = JSON.parse(trimmed.slice(5).trim()) as {
              type?: string;
              delta?: { text?: string };
            };
            if (json.type === "content_block_delta" && json.delta?.text) {
              content += json.delta.text;
            }
          } catch {
            // keep-alives are not JSON
          }
        }
      }
      return content;
    } catch (err) {
      logger.warn("Anthropic stream interrupted", {
        error: err instanceof Error ? err.message : String(err),
      });
      return content;
    }
  }
}

export class RuleBasedProvider implements LLMProvider {
  name: LLMProviderName = "rule-based";

  async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    const last = messages[messages.length - 1]?.content || "";
    return {
      content: `[rule-based] Analyzed input (${last.length} chars). Enable a real LLM provider for intelligent reviews.`,
      model: "rule-based",
      provider: "rule-based",
    };
  }
}

/* ── Factory ─────────────────────────────────────────────── */

export interface ProviderSpec {
  name: LLMProviderName;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function createLLMProvider(
  provider: LLMProviderName = "rule-based",
  apiKey?: string,
): LLMProvider {
  const key = apiKey || process.env.HEXVAULT_API_KEY || "";

  switch (provider) {
    case "openai":
      return new OpenAICompatibleProvider(
        "openai",
        key || process.env.OPENAI_API_KEY || "",
        process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
        process.env.OPENAI_MODEL || "gpt-4o-mini",
      );
    case "grok":
      return new OpenAICompatibleProvider(
        "grok",
        key || process.env.XAI_API_KEY || "",
        process.env.XAI_BASE_URL || "https://api.x.ai/v1",
        process.env.XAI_MODEL || "grok-2-latest",
      );
    case "anthropic":
      return new AnthropicProvider(key || process.env.ANTHROPIC_API_KEY || "");
    case "ollama":
      return new OpenAICompatibleProvider(
        "ollama",
        "",
        process.env.OLLAMA_HOST || "http://localhost:11434/v1",
        process.env.OLLAMA_MODEL || "llama3.2",
      );
    case "lmstudio":
      return new OpenAICompatibleProvider(
        "lmstudio",
        "",
        process.env.LMSTUDIO_HOST || "http://localhost:1234/v1",
        process.env.LMSTUDIO_MODEL || "local-model",
      );
    case "gemini":
      return new OpenAICompatibleProvider(
        "gemini",
        key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
        process.env.GEMINI_BASE_URL ||
          "https://generativelanguage.googleapis.com/v1beta/openai",
        process.env.GEMINI_MODEL || "gemini-2.0-flash",
      );
    case "openrouter":
      return new OpenAICompatibleProvider(
        "openrouter",
        key || process.env.OPENROUTER_API_KEY || "",
        process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
        process.env.OPENROUTER_MODEL || "openrouter/auto",
      );
    case "groq":
      return new OpenAICompatibleProvider(
        "groq",
        key || process.env.GROQ_API_KEY || "",
        process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
        process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      );
    case "mistral":
      return new OpenAICompatibleProvider(
        "mistral",
        key || process.env.MISTRAL_API_KEY || "",
        process.env.MISTRAL_BASE_URL || "https://api.mistral.ai/v1",
        process.env.MISTRAL_MODEL || "mistral-small-latest",
      );
    case "deepseek":
      return new OpenAICompatibleProvider(
        "deepseek",
        key || process.env.DEEPSEEK_API_KEY || "",
        process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
        process.env.DEEPSEEK_MODEL || "deepseek-chat",
      );
    case "azure":
      return createAzureProvider(key);
    default:
      return new RuleBasedProvider();
  }
}

/** Azure OpenAI uses a different URL shape: /openai/deployments/{deployment}/...?api-version= */
export function createAzureProvider(apiKey?: string): LLMProvider {
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/$/, "");
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-06-01";
  const key = apiKey || process.env.AZURE_OPENAI_API_KEY || "";
  return new AzureOpenAIProvider(key, endpoint, deployment, apiVersion);
}

/**
 * Azure OpenAI composes URLs as {endpoint}/openai/deployments/{deployment}/
 * with an api-version query parameter, which differs from the standard
 * OpenAI-compatible shape.
 */
export class AzureOpenAIProvider extends OpenAICompatibleProvider {
  private readonly apiVersion: string;

  constructor(
    apiKey: string,
    endpoint: string,
    deployment: string,
    apiVersion: string,
  ) {
    super(
      "azure",
      apiKey,
      `${endpoint}/openai/deployments/${deployment}`,
      deployment,
    );
    this.apiVersion = apiVersion;
  }

  protected override chatCompletionsUrl(): string {
    return `${this.baseUrl}/chat/completions?api-version=${encodeURIComponent(this.apiVersion)}`;
  }
}
