/**
 * Environment validation — fail fast when required environment variables
 * are missing or malformed for the requested mode.
 *
 * Secrets themselves are never logged or echoed back.
 */
import { AppError } from "../errors/app-error.js";

export interface EnvReport {
  /** Vars found */
  present: string[];
  /** Vars that are required but missing */
  missing: string[];
  /** Vars present but empty-string */
  empty: string[];
}

/** Known API key variables per provider (used by docs & validation) */
export const PROVIDER_ENV: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  grok: "XAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  groq: "GROQ_API_KEY",
  mistral: "MISTRAL_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  azure: "AZURE_OPENAI_API_KEY",
  ollama: "OLLAMA_HOST",
  lmstudio: "LMSTUDIO_HOST",
};

export function checkEnv(vars: string[]): EnvReport {
  const report: EnvReport = { present: [], missing: [], empty: [] };
  for (const v of vars) {
    const val = process.env[v];
    if (val === undefined || val === null) report.missing.push(v);
    else if (val.trim() === "") report.empty.push(v);
    else report.present.push(v);
  }
  return report;
}

/**
 * Validate that a provider's credentials are present.
 * Throws AppError("PROVIDER_AUTH") when a key is required and absent.
 */
export function requireProviderEnv(
  provider: string,
  opts?: { allowMissing?: boolean; hint?: string },
): void {
  const envName = PROVIDER_ENV[provider];
  if (!envName) return; // unknown provider — caller decides
  const value = process.env[envName] || process.env.HEXVAULT_API_KEY || "";
  if (value.trim()) return;

  if (opts?.allowMissing) {
    return;
  }
  throw new AppError(
    "PROVIDER_AUTH",
    `Missing credentials for provider "${provider}"`,
    {
      details: { env: envName, hint: opts?.hint },
      statusCode: 401,
    },
  );
}

/** Human-readable summary of which providers are configured */
export function providerStatus(): Record<
  string,
  { configured: boolean; env: string }
> {
  const out: Record<string, { configured: boolean; env: string }> = {};
  for (const [provider, envName] of Object.entries(PROVIDER_ENV)) {
    const value = process.env[envName] || process.env.HEXVAULT_API_KEY || "";
    out[provider] = { configured: Boolean(value.trim()), env: envName };
  }
  // Ollama / LM Studio need a host, not a key
  out.ollama.configured = Boolean(
    process.env.OLLAMA_HOST || "http://localhost:11434",
  );
  out.lmstudio.configured = Boolean(
    process.env.LMSTUDIO_HOST || "http://localhost:1234/v1",
  );
  return out;
}
