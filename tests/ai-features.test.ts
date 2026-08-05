import { describe, it, expect, afterEach } from "vitest";
import {
  generateChangelog,
  explainCode,
  generateTests,
  analyzeDependencies,
  analyzeIssue,
  generateDocs,
} from "../src/core/ai/features.js";

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

describe("AI feature rule fallbacks", () => {
  it("changelog falls back to rule-based output", async () => {
    clearEnv();
    const res = await generateChangelog({
      version: "3.1.0",
      items: [{ title: "Add sqlite adapter", type: "refactor" }],
    });
    expect(res.source).toBe("rules");
    expect(res.content.length).toBeGreaterThan(0);
    expect(res.content.toLowerCase()).toContain("sqlite");
  });

  it("explainCode falls back without an LLM", async () => {
    clearEnv();
    const res = await explainCode("function add(a, b) { return a + b; }");
    expect(res.source).toBe("rules");
    expect(res.content.toLowerCase()).toContain("add");
  });

  it("generateTests falls back with a usable test file", async () => {
    clearEnv();
    const res = await generateTests(
      "export function sum(a, b) { return a + b; }",
      "vitest",
    );
    expect(res.source).toBe("rules");
    expect(res.content).toMatch(/test|describe|assert/i);
  });

  it("analyzeDependencies parses manifests into a report", async () => {
    clearEnv();
    const deps = analyzeDependencies([
      {
        path: "package.json",
        json: {
          dependencies: { zod: "3.24.1" },
          devDependencies: { vitest: "2.1.8" },
          optionalDependencies: { "better-sqlite3": "11.10.0" },
        },
      },
    ]);
    expect(deps.length).toBe(3);
    const zod = deps.find((d) => d.name === "zod");
    expect(zod?.isDev).toBe(false);
    const vitest = deps.find((d) => d.name === "vitest");
    expect(vitest?.isDev).toBe(true);
    const sqlite = deps.find((d) => d.name === "better-sqlite3");
    expect(sqlite?.optional).toBe(true);
  });

  it("analyzeIssue returns structured rule analysis", async () => {
    clearEnv();
    const res = await analyzeIssue({
      title: "Crash on startup",
      body: "Fails at boot",
    });
    expect(res.source).toBe("rules");
    expect(typeof res.content).toBe("string");
  });

  it("generateDocs falls back to rule-based docs", async () => {
    clearEnv();
    const res = await generateDocs({
      filePath: "src/util/math.ts",
      code: "export function sum(a, b) { return a + b; }",
      language: "typescript",
    } as never);
    expect(res.source).toBe("rules");
    expect(res.content.toLowerCase()).toContain("math");
  });
});
