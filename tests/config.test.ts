import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  loadConfig,
  createDefaultConfig,
  DEFAULT_CONFIG,
  hexVaultConfigSchema,
} from "../src/config/index.js";
import { AppError } from "../src/core/errors/app-error.js";

describe("config validation", () => {
  it("deep-merges partial config with defaults", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hexvault-cfg-"));
    fs.writeFileSync(
      path.join(dir, ".hexvault.yml"),
      `memory:\n  path: custom.db\n  defaultTtlDays: 30\nreview:\n  model: gpt-5\n`,
    );
    const cfg = loadConfig(dir);
    expect(cfg.memory.path).toBe("custom.db");
    expect(cfg.memory.defaultTtlDays).toBe(30);
    expect(cfg.review.model).toBe("gpt-5");
    // untouched defaults survive
    expect(cfg.llm.priority.length).toBe(DEFAULT_CONFIG.llm.priority.length);
    expect(cfg.multiRepo).toBeDefined();
    expect(cfg.webhooks).toBeDefined();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects invalid config with AppError CONFIG_INVALID", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hexvault-cfg-bad-"));
    fs.writeFileSync(
      path.join(dir, ".hexvault.yml"),
      `memory:\n  path: 12345\n`,
    );
    let caught: AppError | null = null;
    try {
      loadConfig(dir);
    } catch (e) {
      caught = e as AppError;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect(caught?.code).toBe("CONFIG_INVALID");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("loadConfig falls back to defaults without a config file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hexvault-cfg-none-"));
    const cfg = loadConfig(dir);
    expect(cfg.memory.path).toBe(DEFAULT_CONFIG.memory.path);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("createDefaultConfig writes a valid config file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hexvault-cfg-init-"));
    expect(createDefaultConfig(dir)).toBe(true);
    const file = path.join(dir, ".hexvault.yml");
    expect(fs.existsSync(file)).toBe(true);
    const parsed = hexVaultConfigSchema.parse(
      JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
    );
    expect(parsed.memory.vector).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
