/**
 * Unified LLM Provider Interface
 * Supports: OpenAI, Anthropic, Grok (xAI), Ollama (local)
 */

export type LLMProviderName = "openai" | "anthropic" | "grok" | "ollama" | "rule-based";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface LLMProvider {
  name: LLMProviderName;
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
}

/** OpenAI-compatible provider (works with OpenAI, Grok, many proxies) */
export class OpenAICompatibleProvider implements LLMProvider {
  name: LLMProviderName;
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(
    name: LLMProviderName,
    apiKey: string,
    baseUrl: string,
    defaultModel: string
  ) {
    this.name = name;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.defaultModel = defaultModel;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const model = options.model || this.defaultModel;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2048,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM API error (${res.status}): ${text}`);
    }

    const data = await res.json() as any;
    return {
      content: data.choices?.[0]?.message?.content || "",
      model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  }
}

export class RuleBasedProvider implements LLMProvider {
  name: LLMProviderName = "rule-based";

  async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    // Fallback: return a simple acknowledgment
    const last = messages[messages.length - 1]?.content || "";
    return {
      content: `[rule-based] Analyzed input (${last.length} chars). Enable a real LLM provider for intelligent reviews.`,
      model: "rule-based",
    };
  }
}

export function createLLMProvider(
  provider: LLMProviderName = "rule-based",
  apiKey?: string
): LLMProvider {
  const key = apiKey || process.env.HEXVAULT_API_KEY || process.env.OPENAI_API_KEY || "";

  switch (provider) {
    case "openai":
      return new OpenAICompatibleProvider(
        "openai",
        key,
        "https://api.openai.com/v1",
        "gpt-4o-mini"
      );
    case "grok":
      return new OpenAICompatibleProvider(
        "grok",
        key || process.env.XAI_API_KEY || "",
        "https://api.x.ai/v1",
        "grok-2-latest"
      );
    case "anthropic":
      // Anthropic uses different API shape; for now use OpenAI-compatible proxy pattern
      // or implement native later. Using OpenAI-compatible for simplicity.
      return new OpenAICompatibleProvider(
        "anthropic",
        key || process.env.ANTHROPIC_API_KEY || "",
        process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1",
        "claude-3-5-sonnet-20241022"
      );
    case "ollama":
      return new OpenAICompatibleProvider(
        "ollama",
        "ollama",
        process.env.OLLAMA_HOST || "http://localhost:11434/v1",
        process.env.OLLAMA_MODEL || "llama3.2"
      );
    default:
      return new RuleBasedProvider();
  }
}
