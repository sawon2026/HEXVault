import fs from "fs";
import path from "path";
import YAML from "yaml";

export interface HexVaultConfig {
  memory: {
    path: string;
    vector: boolean;
  };
  review: {
    model: string;
    severity: "low" | "medium" | "high";
    checks: string[];
    customRules: string[];
  };
  llm: {
    provider: "rule-based" | "openai" | "anthropic" | "grok" | "ollama";
    apiKeyEnv: string;
    model?: string;
  };
  notifications: {
    enabled: boolean;
    channel: "slack" | "discord" | "webhook";
    webhookUrlEnv: string;
  };
  multiRepo: {
    enabled: boolean;
    configPath: string;
  };
  ignore: string[];
}

const DEFAULT_CONFIG: HexVaultConfig = {
  memory: {
    path: ".hexvault/memory.db",
    vector: true,
  },
  review: {
    model: "rule-based",
    severity: "medium",
    checks: ["security", "consistency", "best-practices"],
    customRules: [],
  },
  llm: {
    provider: "rule-based",
    apiKeyEnv: "HEXVAULT_API_KEY",
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
  ignore: ["**/*.test.ts", "**/*.spec.ts", "docs/**", "node_modules/**"],
};

export function loadConfig(cwd = process.cwd()): HexVaultConfig {
  const configPath = path.join(cwd, ".hexvault.yml");
  if (!fs.existsSync(configPath)) {
    return structuredClone(DEFAULT_CONFIG);
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = YAML.parse(raw) || {};
    return {
      memory: { ...DEFAULT_CONFIG.memory, ...parsed.memory },
      review: {
        ...DEFAULT_CONFIG.review,
        ...parsed.review,
        customRules: parsed.review?.customRules || DEFAULT_CONFIG.review.customRules,
        checks: parsed.review?.checks || DEFAULT_CONFIG.review.checks,
      },
      llm: { ...DEFAULT_CONFIG.llm, ...parsed.llm },
      notifications: { ...DEFAULT_CONFIG.notifications, ...parsed.notifications },
      multiRepo: { ...DEFAULT_CONFIG.multiRepo, ...parsed.multiRepo },
      ignore: parsed.ignore || DEFAULT_CONFIG.ignore,
    };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export function createDefaultConfig(cwd = process.cwd()) {
  const configPath = path.join(cwd, ".hexvault.yml");
  if (fs.existsSync(configPath)) return false;

  const content = `# HEXVault Configuration
memory:
  path: .hexvault/memory.db
  vector: true

review:
  model: rule-based
  severity: medium
  checks:
    - security
    - consistency
    - best-practices
  customRules: []

llm:
  provider: rule-based
  apiKeyEnv: HEXVAULT_API_KEY

notifications:
  enabled: false
  channel: discord
  webhookUrlEnv: HEXVAULT_WEBHOOK_URL

multiRepo:
  enabled: false
  configPath: .hexvault/multi-repo.json

ignore:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "docs/**"
  - "node_modules/**"
`;

  fs.writeFileSync(configPath, content, "utf-8");
  return true;
}
