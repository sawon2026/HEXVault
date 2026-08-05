import { describe, it, expect, afterEach } from "vitest";
import { LLMRegistry } from "../src/core/llm/registry.js";
import { AppError } from "../src/core/errors/app-error.js";

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "ANTHROPIC_API_KEY",
  "XAI_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "GROQ_API_KEY",
  "MISTRAL_API_KEY",
  "DEEPSEEK_API_KEY",
  "AZURE_OPENAI_API_KEY",
  "OLLAMA_HOST",
  "LMSTUDIO_HOST",
  "HEXVAULT_LLM_PRIORITY",
];

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

afterEach(clearEnv);

describe("LLMRegistry", () => {
  it("falls back to rule-based when no providers are configured", async () => {
    clearEnv();
    const reg = new LLMRegistry();
    const res = await reg.complete([{ role: "user", content: "hello" }]);
    expect(res.model).toBe("rule-based");
    expect(res.content.length).toBeGreaterThan(0);
  });

  it("listConfigured reports only real providers (no rule-based)", () => {
    const reg = new LLMRegistry({ priority: ["ollama", "openai"] });
    expect(reg.listConfigured()).toEqual(["ollama", "openai"]);
  });

  it("status() maps provider env keys", () => {
    clearEnv();
    const reg = new LLMRegistry();
    const st = reg.status();
    expect(st["openai"]).toEqual({ configured: false, env: "OPENAI_API_KEY" });
    process.env.OPENAI_API_KEY = "sk-test";
    const st2 = reg.status();
    expect(st2["openai"].configured).toBe(true);
  });

  it("respects explicit priority order", () => {
    clearEnv();
    const reg = new LLMRegistry({ priority: ["lmstudio", "ollama"] });
    expect(reg.listConfigured().slice(0, 2)).toEqual(["lmstudio", "ollama"]);
  });

  it("allowFallback:false throws LLM_PROVIDER instead of rule fallback", async () => {
    clearEnv();
    process.env.OPENAI_BASE_URL = "http://127.0.0.1:1/v1";
    process.env.OPENAI_API_KEY = "test-key";
    const reg = new LLMRegistry({ priority: ["openai"], allowFallback: false });
    await expect(
      reg.complete([{ role: "user", content: "hi" }]),
    ).rejects.toBeInstanceOf(AppError);
  });
});
