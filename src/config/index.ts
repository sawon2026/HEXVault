/**
 * HEXVault configuration — loading, defaults, and strict Zod validation.
 *
 * The config file (.hexvault.yml) is validated at load time; invalid files
 * fail fast with actionable errors instead of silently misbehaving.
 */
import fs from "fs";
import path from "path";
import YAML from "yaml";
import { z } from "zod";
import { AppError } from "../core/errors/app-error.js";
import { log } from "../core/logging/logger.js";

const logger = log.child("config");

/* ── Zod schemas ──────────────────────────────────────────── */

export const memoryConfigSchema = z.object({
  path: z.string().default(".hexvault/memory.db"),
  vector: z.boolean().default(true),
  defaultTtlDays: z.number().int().min(0).default(0),
  dedupThreshold: z.number().min(0).max(1).default(0.92),
});

export const reviewConfigSchema = z.object({
  model: z.string().default("rule-based"),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
  checks: z
    .array(z.string())
    .default(["security", "consistency", "best-practices"]),
  customRules: z.array(z.string()).default([]),
  maxMemories: z.number().int().min(1).max(50).default(8),
});

export const llmConfigSchema = z.object({
  provider: z.string().default("rule-based"),
  apiKeyEnv: z.string().default("HEXVAULT_API_KEY"),
  model: z.string().optional(),
  priority: z.array(z.string()).default(["rule-based"]),
  maxRetries: z.number().int().min(0).max(10).default(2),
  retryDelayMs: z.number().int().min(0).default(400),
  temperature: z.number().min(0).max(2).default(0.3),
  maxTokens: z.number().int().min(1).default(2048),
});

export const notificationsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  channel: z
    .enum(["slack", "discord", "webhook", "teams", "notion", "jira", "linear"])
    .default("discord"),
  webhookUrlEnv: z.string().default("HEXVAULT_WEBHOOK_URL"),
});

export const multiRepoConfigSchema = z.object({
  enabled: z.boolean().default(false),
  configPath: z.string().default(".hexvault/multi-repo.json"),
});

export const webhooksConfigSchema = z.object({
  enabled: z.boolean().default(false),
  port: z.number().int().min(1).max(65535).default(3852),
  secret: z.string().optional(),
  events: z
    .array(z.string())
    .default(["memory.added", "review.completed", "sync.imported"]),
});

export const hexVaultConfigSchema = z.object({
  memory: memoryConfigSchema,
  review: reviewConfigSchema,
  llm: llmConfigSchema,
  notifications: notificationsConfigSchema,
  multiRepo: multiRepoConfigSchema,
  webhooks: webhooksConfigSchema,
  ignore: z
    .array(z.string())
    .default(["**/*.test.ts", "**/*.spec.ts", "docs/**", "node_modules/**"]),
});

export type HexVaultConfig = z.infer<typeof hexVaultConfigSchema>;

export const DEFAULT_CONFIG: HexVaultConfig = {
  memory: {
    path: ".hexvault/memory.db",
    vector: true,
    defaultTtlDays: 0,
    dedupThreshold: 0.92,
  },
  review: {
    model: "rule-based",
    severity: "medium",
    checks: ["security", "consistency", "best-practices"],
    customRules: [],
    maxMemories: 8,
  },
  llm: {
    provider: "rule-based",
    apiKeyEnv: "HEXVAULT_API_KEY",
    priority: ["rule-based"],
    maxRetries: 2,
    retryDelayMs: 400,
    temperature: 0.3,
    maxTokens: 2048,
  },
  notifications: {
    enabled: false,
    channel: "discord",
    webhookUrlEnv: "HEXVAULT_WEBHOOK_URL",
  },
  multiRepo: {
    enabled: false,
    configPath: ".hexvault/multi-repo.json",
  },
  webhooks: {
    enabled: false,
    port: 3852,
    events: ["memory.added", "review.completed", "sync.imported"],
  },
  ignore: ["**/*.test.ts", "**/*.spec.ts", "docs/**", "node_modules/**"],
};

/** Deep-merge raw YAML over defaults, then validate strictly. */
export function loadConfig(cwd = process.cwd()): HexVaultConfig {
  const configPath = path.join(cwd, ".hexvault.yml");

  let raw: unknown = {};
  if (fs.existsSync(configPath)) {
    try {
      raw = YAML.parse(fs.readFileSync(configPath, "utf-8")) || {};
    } catch (err) {
      throw new AppError("CONFIG_INVALID", `Invalid YAML in ${configPath}`, {
        details: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  const merged = deepMerge(structuredClone(DEFAULT_CONFIG), raw);
  const parsed = hexVaultConfigSchema.safeParse(merged);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`,
    );
    throw new AppError("CONFIG_INVALID", `Invalid configuration`, {
      details: { file: configPath, issues },
    });
  }

  logger.debug("Config loaded", {
    path: configPath,
    source: fs.existsSync(configPath) ? "file" : "defaults",
  });
  return parsed.data;
}

/** Deep merge plain objects + arrays (arrays replace). */
function deepMerge(
  base: Record<string, unknown>,
  over: unknown,
): Record<string, unknown> {
  if (!over || typeof over !== "object" || Array.isArray(over)) {
    return base;
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over as Record<string, unknown>)) {
    const baseValue = result[key];
    if (
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue) &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      result[key] = deepMerge(baseValue as Record<string, unknown>, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function createDefaultConfig(cwd = process.cwd()): boolean {
  const configPath = path.join(cwd, ".hexvault.yml");
  if (fs.existsSync(configPath)) return false;

  const content = `# HEXVault Configuration
memory:
  path: .hexvault/memory.db
  vector: true
  defaultTtlDays: 0
  dedupThreshold: 0.92

review:
  model: rule-based
  severity: medium
  checks:
    - security
    - consistency
    - best-practices
  customRules: []
  maxMemories: 8

llm:
  provider: rule-based
  apiKeyEnv: HEXVAULT_API_KEY
  priority: [rule-based]
  maxRetries: 2
  retryDelayMs: 400
  temperature: 0.3
  maxTokens: 2048

notifications:
  enabled: false
  channel: discord
  webhookUrlEnv: HEXVAULT_WEBHOOK_URL

multiRepo:
  enabled: false
  configPath: .hexvault/multi-repo.json

webhooks:
  enabled: false
  port: 3852
  events:
    - memory.added
    - review.completed
    - sync.imported

ignore:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "docs/**"
  - "node_modules/**"
`;

  fs.writeFileSync(configPath, content, "utf-8");
  return true;
}
