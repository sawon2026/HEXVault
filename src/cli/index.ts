#!/usr/bin/env node
/**
 * HEXVault CLI v3.0.0
 * Commands: init, add, search, list, stats, review, commit-msg, release-notes,
 * changelog, ask, analyze, docs, explain, deps, providers, timeline, tags,
 * health, delete, update, link, webhook-test, sync-export, sync-import, tui
 */
import { Command } from "commander";
import chalk from "chalk";
import path from "path";
import fs from "fs";
import { MemoryStore } from "../core/memory/store.js";
import { MemoryEngine } from "../core/memory/engine.js";
import { loadConfig, createDefaultConfig } from "../config/index.js";
import { ReviewEngine } from "../core/review/reviewer.js";
import {
  generateCommitMessage,
  generateReleaseNotes,
} from "../core/ai/generators.js";
import {
  generateChangelog,
  generateDocs,
  explainCode,
  analyzeDependencyReport,
  analyzeIssue,
} from "../core/ai/features.js";
import { repoChat } from "../core/ai/repo-chat.js";
import { LLMRegistry } from "../core/llm/registry.js";
import { endpointsFromEnv, deliverWebhooks } from "../core/webhooks/emitter.js";

const VERSION = "3.0.0";
const program = new Command();

program
  .name("hexvault")
  .description(
    "HEXVault — AI Memory Platform: project memory, smart PR review, multi-provider LLMs",
  )
  .version(VERSION);

/* ── init ────────────────────────────────────────────────── */

program
  .command("init")
  .description("Initialize HEXVault in the current project")
  .action(() => {
    const cwd = process.cwd();
    const created = createDefaultConfig(cwd);

    const memDir = path.join(cwd, ".hexvault");
    if (!fs.existsSync(memDir)) {
      fs.mkdirSync(memDir, { recursive: true });
    }

    const config = loadConfig(cwd);
    const store = new MemoryStore({
      dbPath: path.join(cwd, config.memory.path),
    });
    store.close();

    console.log(chalk.green("✓ HEXVault initialized!"));
    if (created) {
      console.log(chalk.gray("  Created .hexvault.yml"));
    }
    console.log(chalk.gray("  Created .hexvault/memory.db"));
    console.log();
    console.log("Next steps:");
    console.log(
      chalk.cyan(
        '  hexvault add "We decided to use SQLite for local storage" --type decision',
      ),
    );
    console.log(chalk.cyan('  hexvault search "database"'));
    console.log(chalk.cyan("  hexvault tui   # interactive terminal UI"));
  });

/* ── add ─────────────────────────────────────────────────── */

program
  .command("add <content>")
  .description("Add a new memory entry (auto-tags + dedup by default)")
  .option(
    "-t, --type <type>",
    "Memory type (decision|bugfix|architecture|pattern|security|note|api|refactor)",
    "note",
  )
  .option("--title <title>", "Title for the memory")
  .option("--tags <tags>", "Comma separated tags")
  .option("--files <files>", "Comma separated related files")
  .option("--category <category>", "Category (e.g. auth, build)")
  .option("--importance <0..1>", "Importance score")
  .option("--ttl-days <n>", "Expire after n days")
  .option("--no-autotag", "Disable automatic tag suggestion")
  .action((content, opts) => {
    const config = loadConfig();
    const engine = new MemoryEngine({
      dbPath: path.resolve(config.memory.path),
      defaultTtlDays: config.memory.defaultTtlDays,
      dedupThreshold: config.memory.dedupThreshold,
    });

    const title = opts.title || content.slice(0, 60);
    const tags = opts.tags
      ? opts.tags.split(",").map((t: string) => t.trim())
      : [];
    const files = opts.files
      ? opts.files.split(",").map((f: string) => f.trim())
      : [];

    const entry = engine.add(title, content, {
      type: opts.type,
      tags,
      files,
      source: "manual",
      category: opts.category,
      importance:
        opts.importance !== undefined ? Number(opts.importance) : undefined,
      ttlDays: opts.ttlDays !== undefined ? Number(opts.ttlDays) : undefined,
      autoTag: opts.autotag,
    });

    engine.close();

    console.log(chalk.green("✓ Memory added"));
    console.log(chalk.gray(`  ID: ${entry.id}`));
    console.log(chalk.gray(`  Type: ${entry.type}`));
    console.log(chalk.gray(`  Title: ${entry.title}`));
    if (entry.tags.length) {
      console.log(chalk.gray(`  Tags: ${entry.tags.join(", ")}`));
    }
    if (entry.importance) {
      console.log(chalk.gray(`  Importance: ${entry.importance.toFixed(2)}`));
    }
  });

/* ── search / list / stats / timeline / tags / health ────── */

program
  .command("search <query>")
  .description("Hybrid search project memories (keyword + semantic)")
  .option("-l, --limit <n>", "Max results", "10")
  .option("--json", "JSON output for scripting")
  .action((query, opts) => {
    const config = loadConfig();
    const engine = new MemoryEngine({
      dbPath: path.resolve(config.memory.path),
      defaultTtlDays: config.memory.defaultTtlDays,
    });

    const results = engine.hybridSearch(query, parseInt(opts.limit, 10));
    engine.close();

    if (opts.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    if (results.length === 0) {
      console.log(chalk.yellow("No memories found."));
      return;
    }

    console.log(chalk.bold(`\nFound ${results.length} memories:\n`));
    for (const r of results) {
      console.log(
        chalk.cyan(`[${r.entry.type}]`) +
          " " +
          chalk.bold(r.entry.title) +
          chalk.gray(
            `  (rank ${r.rankScore.toFixed(2)}, imp ${r.importance.toFixed(2)})`,
          ),
      );
      console.log(chalk.gray(`  ${r.entry.content.slice(0, 120)}...`));
      if (r.entry.tags.length) {
        console.log(chalk.gray(`  tags: ${r.entry.tags.join(", ")}`));
      }
      console.log();
    }
  });

program
  .command("list")
  .description("List recent memories")
  .option("-t, --type <type>", "Filter by type")
  .option("-l, --limit <n>", "Max results", "20")
  .option("--json", "JSON output")
  .action((opts) => {
    const config = loadConfig();
    const engine = new MemoryEngine({
      dbPath: path.resolve(config.memory.path),
      defaultTtlDays: config.memory.defaultTtlDays,
    });

    const entries = engine.list(parseInt(opts.limit, 10), opts.type);
    engine.close();

    if (opts.json) {
      console.log(JSON.stringify(entries, null, 2));
      return;
    }

    if (entries.length === 0) {
      console.log(
        chalk.yellow("No memories yet. Use `hexvault add` to create some."),
      );
      return;
    }

    console.log(chalk.bold(`\nRecent memories (${entries.length}):\n`));
    for (const e of entries) {
      console.log(
        chalk.cyan(`[${e.type}]`) +
          " " +
          chalk.bold(e.title) +
          chalk.gray(
            `  (${e.createdAt.slice(0, 10)})` +
              (e.category ? ` [${e.category}]` : ""),
          ),
      );
    }
  });

program
  .command("stats")
  .description("Show memory statistics")
  .option("--json", "JSON output")
  .action((opts) => {
    const config = loadConfig();
    const engine = new MemoryEngine({
      dbPath: path.resolve(config.memory.path),
      defaultTtlDays: config.memory.defaultTtlDays,
    });

    const stats = engine.stats();
    engine.close();

    if (opts.json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log(chalk.bold("\nHEXVault Stats\n"));
    console.log(`Total memories: ${chalk.green(stats.total)}`);
    console.log("\nBy type:");
    for (const [type, count] of Object.entries(stats.byType || {})) {
      console.log(`  ${type}: ${count}`);
    }
    if (Object.keys(stats.byCategory || {}).length) {
      console.log("\nBy category:");
      for (const [category, count] of Object.entries(stats.byCategory || {})) {
        console.log(`  ${category}: ${count}`);
      }
    }
  });

program
  .command("timeline")
  .description("Memory creation timeline by day")
  .option("-l, --limit <n>", "Memories to scan", "200")
  .option("--json", "JSON output")
  .action((opts) => {
    const config = loadConfig();
    const engine = new MemoryEngine({
      dbPath: path.resolve(config.memory.path),
    });
    const items = engine.timeline(parseInt(opts.limit, 10));
    engine.close();

    if (opts.json) {
      console.log(JSON.stringify(items, null, 2));
      return;
    }
    if (!items.length) {
      console.log(chalk.yellow("No timeline data."));
      return;
    }
    console.log(chalk.bold("\nMemory timeline\n"));
    for (const item of items.slice(-20)) {
      console.log(
        `  ${chalk.gray(item.date)}  ${chalk.green(String(item.count).padStart(3))}  ${chalk.gray(JSON.stringify(item.types))}`,
      );
    }
  });

program
  .command("tags")
  .description("Tag cloud (most used tags)")
  .option("-l, --limit <n>", "Max tags", "20")
  .option("--json", "JSON output")
  .action((opts) => {
    const config = loadConfig();
    const engine = new MemoryEngine({
      dbPath: path.resolve(config.memory.path),
    });
    const tags = engine.tagStats(parseInt(opts.limit, 10));
    engine.close();

    if (opts.json) {
      console.log(JSON.stringify(tags, null, 2));
      return;
    }
    if (!tags.length) {
      console.log(chalk.yellow("No tags yet."));
      return;
    }
    console.log(chalk.bold("\nTag cloud\n"));
    for (const t of tags) {
      console.log(
        `  ${chalk.cyan(t.tag.padEnd(24))} ${chalk.gray("×" + t.count)}`,
      );
    }
  });

program
  .command("health")
  .description("Memory health dashboard report")
  .option("--json", "JSON output")
  .action((opts) => {
    const config = loadConfig();
    const engine = new MemoryEngine({
      dbPath: path.resolve(config.memory.path),
    });
    const report = engine.health();
    engine.close();

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log(chalk.bold("\nHEXVault Memory Health\n"));
    console.log(
      `  Status:           ${report.ok ? chalk.green("HEALTHY") : chalk.yellow("NEEDS ATTENTION")}`,
    );
    console.log(`  Total:            ${report.total}`);
    console.log(`  Expired:          ${report.expiredCount}`);
    console.log(`  Stale (>180d):    ${report.staleCount}`);
    console.log(
      `  Importance avg:   ${report.importanceAvg.toFixed(2)} (high: ${report.importanceHigh})`,
    );
    console.log(`  Categories:       ${report.categoryCount}`);
    console.log(`  Tags:             ${report.tagsCount}`);
    console.log(`  Links:            ${report.linksCount}`);
    console.log(`  Orphaned:         ${report.orphanedCount}`);
    console.log(`  Active (14d):     ${report.recentActivity}`);
    if (report.warnings.length) {
      console.log(chalk.yellow("\n  Warnings:"));
      report.warnings.forEach((w) => console.log(`    - ${w}`));
    }
    if (report.recommendations.length) {
      console.log(chalk.gray("\n  Recommendations:"));
      report.recommendations.forEach((r) => console.log(`    - ${r}`));
    }
  });

/* ── delete / update / link ──────────────────────────────── */

program
  .command("delete <id>")
  .description("Delete a memory by id")
  .action((id) => {
    const config = loadConfig();
    const engine = new MemoryEngine({
      dbPath: path.resolve(config.memory.path),
    });
    const ok = engine.delete(id);
    engine.close();
    console.log(
      ok ? chalk.green("✓ Deleted") : chalk.yellow(`Memory ${id} not found`),
    );
  });

program
  .command("update <id>")
  .description("Update a memory (title/content/type/tags/category)")
  .option("--title <title>", "New title")
  .option("--content <content>", "New content")
  .option("--type <type>", "New type")
  .option("--tags <tags>", "Comma separated tags (replaces)")
  .option("--category <category>", "New category")
  .option("--importance <0..1>", "New importance")
  .action((id, opts) => {
    const config = loadConfig();
    const engine = new MemoryEngine({
      dbPath: path.resolve(config.memory.path),
    });
    const updated = engine.update(id, {
      title: opts.title,
      content: opts.content,
      type: opts.type,
      tags: opts.tags
        ? opts.tags.split(",").map((t: string) => t.trim())
        : undefined,
      category: opts.category,
      importance:
        opts.importance !== undefined ? Number(opts.importance) : undefined,
    });
    engine.close();
    if (!updated) {
      console.log(chalk.yellow(`Memory ${id} not found`));
      return;
    }
    console.log(chalk.green("✓ Updated"));
    console.log(chalk.gray(`  ${updated.title}`));
  });

program
  .command("link <id>")
  .description("Link a memory to a repository / workspace / conversation")
  .requiredOption(
    "--kind <kind>",
    "repository|workspace|conversation|commit|issue|pr",
  )
  .requiredOption("--target <id>", "Target entity id")
  .option("--label <label>", "Optional label")
  .action((id, opts) => {
    const config = loadConfig();
    const engine = new MemoryEngine({
      dbPath: path.resolve(config.memory.path),
    });
    const updated = engine.linkMemory(id, {
      kind: opts.kind,
      id: opts.target,
      label: opts.label,
    });
    engine.close();
    if (!updated) {
      console.log(chalk.yellow(`Memory ${id} not found`));
      return;
    }
    console.log(chalk.green(`✓ Linked memory to ${opts.kind}:${opts.target}`));
  });

/* ── review ──────────────────────────────────────────────── */

program
  .command("review")
  .description("Run a local review (demo mode)")
  .option("--title <title>", "PR title", "Demo PR")
  .option("--body <body>", "PR body", "")
  .option("--diff <file>", "Diff file to review")
  .action(async (opts) => {
    const config = loadConfig();
    const engine = new MemoryEngine({
      dbPath: path.resolve(config.memory.path),
      defaultTtlDays: config.memory.defaultTtlDays,
    });

    let diff = "+ console.log('hello')\n- console.log('old')";
    if (opts.diff) {
      diff = fs.readFileSync(path.resolve(opts.diff), "utf8");
    }

    const memories = engine
      .hybridSearch(`${opts.title} ${opts.body}`.slice(0, 300), 10)
      .map((h) => h.entry);
    engine.close();

    const review = new ReviewEngine({
      ...config.review,
      model: config.review.model,
    });
    const result = await review.review(opts.title, opts.body, diff, memories);

    console.log(chalk.bold("\n=== HEXVault Review ===\n"));
    console.log(result.summary);
    console.log("\nScore:", chalk.green(result.score + "/100"));

    if (result.comments.length) {
      console.log("\nComments:");
      result.comments.forEach((c) => {
        console.log(`  [${c.severity}] ${c.body.slice(0, 100)}`);
      });
    }
  });

/* ── AI generators ───────────────────────────────────────── */

program
  .command("commit-msg")
  .description(
    "Generate a conventional commit message from a summary or diff file",
  )
  .argument("[input]", "Change summary (or omit and use --file)")
  .option("-f, --file <path>", "Read diff/summary from file")
  .action(async (input, opts) => {
    let text = input || "";
    if (opts.file) {
      text = fs.readFileSync(path.resolve(opts.file), "utf8");
    }
    if (!text.trim()) {
      console.error(chalk.red("Provide a summary argument or --file"));
      process.exit(1);
    }
    const { message, source } = await generateCommitMessage({ input: text });
    console.log(message);
    console.error(chalk.gray(`# source: ${source}`));
  });

program
  .command("release-notes")
  .description("Generate Markdown release notes")
  .requiredOption("-v, --version <ver>", "Version string e.g. v1.2.0")
  .option("-i, --items <list>", "Comma-separated change items")
  .option("-f, --file <path>", "File with one change per line")
  .action(async (opts) => {
    let items: string[] = [];
    if (opts.file) {
      items = fs
        .readFileSync(path.resolve(opts.file), "utf8")
        .split(/\n/)
        .map((l: string) => l.trim())
        .filter(Boolean);
    } else if (opts.items) {
      items = opts.items
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    if (!items.length) {
      items = ["General improvements and fixes"];
    }
    const { notes, source } = await generateReleaseNotes({
      version: opts.version,
      items,
      projectName: "HEXVault",
    });
    console.log(notes);
    console.error(chalk.gray(`# source: ${source}`));
  });

program
  .command("changelog")
  .description("Generate a Keep-a-Changelog section from commit/PR items")
  .requiredOption("-v, --version <ver>", "Version string e.g. v1.2.0")
  .option("-f, --file <path>", "File with one change per line")
  .option("-i, --items <list>", "Comma-separated change items")
  .action(async (opts) => {
    let items: string[] = [];
    if (opts.file) {
      items = fs
        .readFileSync(path.resolve(opts.file), "utf8")
        .split(/\n/)
        .map((l: string) => l.trim())
        .filter(Boolean);
    } else if (opts.items) {
      items = opts.items
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    const { content, source } = await generateChangelog({
      version: opts.version,
      items: items.map((title) => ({ title })),
      projectName: "HEXVault",
    });
    console.log(content);
    console.error(chalk.gray(`# source: ${source}`));
  });

program
  .command("docs <file>")
  .description("Generate documentation for a source file")
  .action(async (file) => {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) {
      console.error(chalk.red(`File not found: ${file}`));
      process.exit(1);
    }
    const code = fs.readFileSync(abs, "utf8");
    const { content, source } = await generateDocs({ filePath: file, code });
    console.log(content);
    console.error(chalk.gray(`# source: ${source}`));
  });

program
  .command("explain <file>")
  .description("Explain what a source file does")
  .action(async (file) => {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) {
      console.error(chalk.red(`File not found: ${file}`));
      process.exit(1);
    }
    const code = fs.readFileSync(abs, "utf8");
    const { content, source } = await explainCode(code);
    console.log(content);
    console.error(chalk.gray(`# source: ${source}`));
  });

program
  .command("deps")
  .description("Analyze package dependencies from manifests in this project")
  .option("--review", "Ask the LLM to review the dependency list")
  .action(async (opts) => {
    const manifests = [
      "package.json",
      "apps/web/package.json",
      "packages/sdk/package.json",
    ]
      .map((p) => {
        const abs = path.resolve(p);
        if (!fs.existsSync(abs)) return null;
        try {
          return {
            path: p,
            json: JSON.parse(fs.readFileSync(abs, "utf8")) as Record<
              string,
              unknown
            >,
          };
        } catch {
          return null;
        }
      })
      .filter(
        (m): m is { path: string; json: Record<string, unknown> } => m !== null,
      );

    const { content, source } = await analyzeDependencyReport(manifests, {
      review: opts.review,
    });
    console.log(content.report);
    console.error(chalk.gray(`# source: ${source}`));
  });

program
  .command("providers")
  .description("Show which LLM providers have credentials configured")
  .action(() => {
    const registry = new LLMRegistry();
    const status = registry.status();
    console.log(chalk.bold("\nLLM Provider Status\n"));
    for (const [name, s] of Object.entries(status)) {
      console.log(
        `  ${s.configured ? chalk.green("✓") : chalk.gray("·")}  ${chalk.cyan(name.padEnd(12))} ${chalk.gray(s.env)}`,
      );
    }
    console.log(
      chalk.gray(`\nPriority: ${registry.listConfigured().join(", ")}`),
    );
  });

program
  .command("webhook-test")
  .description("Send a test webhook to configured endpoints")
  .option("--message <text>", "Test message", "HEXVault webhook test")
  .action(async (opts) => {
    const endpoints = endpointsFromEnv();
    if (!endpoints.length) {
      console.log(
        chalk.yellow("No webhook endpoints configured (HEXVAULT_WEBHOOK_URLS)"),
      );
      return;
    }
    const results = await deliverWebhooks(
      {
        type: "memory.added",
        payload: { test: true, message: opts.message },
        timestamp: new Date().toISOString(),
      },
      endpoints,
    );
    for (const r of results) {
      console.log(r.ok ? chalk.green(`✓ ${r.url}`) : chalk.red(`✗ ${r.url}`));
    }
  });

/* ── ask / analyze / issue ───────────────────────────────── */

program
  .command("ask")
  .description("Ask a question against project memories (RAG repo chat)")
  .argument("<question>", "Your question")
  .option("--conversation-id <id>", "Attach to a conversation for linking")
  .action(async (question, opts) => {
    const config = loadConfig();
    const engine = new MemoryEngine({
      dbPath: path.resolve(config.memory.path),
      defaultTtlDays: config.memory.defaultTtlDays,
    });
    const result = await repoChat({ engine, question });
    if (opts.conversationId) {
      engine.recordConversation({
        conversationId: opts.conversationId,
        question,
        answer: result.answer,
        sourceMemories: result.sources.map((s) => s.id),
      });
    }
    engine.close();

    console.log(chalk.bold("\nHEXVault Answer\n"));
    console.log(result.answer);
    if (result.sources.length) {
      console.log(chalk.gray("\nSources (citations):"));
      for (const s of result.sources.slice(0, 5)) {
        console.log(
          chalk.gray(`  - [${s.type}] ${s.title} (${s.rankScore.toFixed(2)})`),
        );
      }
    }
    console.log(chalk.gray(`\n# source: ${result.source}`));
  });

program
  .command("analyze")
  .description("Complexity + dead-code heuristics for the current project")
  .option("-n, --top <n>", "Top hotspot files", "15")
  .action(async (opts) => {
    const { analyzeProject } = await import("../core/analysis/heuristics.js");
    const report = await analyzeProject({
      cwd: process.cwd(),
      topN: parseInt(opts.top, 10),
    });
    console.log(chalk.bold("\nHEXVault Analysis\n"));
    console.log(`Files scanned: ${report.filesScanned}`);
    console.log(`Avg complexity: ${report.summary.avgScore}/100`);
    console.log(`Max complexity: ${report.summary.maxScore}/100`);
    console.log(`Dead-code hints: ${report.summary.deadHints}`);
    if (report.hotspots.length) {
      console.log(chalk.bold("\nHotspots:\n"));
      for (const h of report.hotspots.slice(0, 10)) {
        console.log(
          `  ${chalk.yellow(String(h.score).padStart(3))}  ${h.file}  (lines=${h.lines}, cyclo≈${h.cyclomaticApprox})`,
        );
      }
    }
    const serious = report.deadCode.filter((d) =>
      ["debugger", "empty-catch", "unused-export"].includes(d.kind),
    );
    if (serious.length) {
      console.log(chalk.bold("\nNotable hints:\n"));
      for (const d of serious.slice(0, 15)) {
        console.log(
          `  ${d.file}:${d.line}  [${d.kind}] ${d.symbol} — ${d.detail.slice(0, 60)}`,
        );
      }
    }
  });

program
  .command("issue")
  .description("Analyze an issue (title/body/labels)")
  .requiredOption("--title <title>", "Issue title")
  .option("--body <body>", "Issue body")
  .option("--labels <labels>", "Comma separated labels")
  .action(async (opts) => {
    const { content, source } = await analyzeIssue({
      title: opts.title,
      body: opts.body,
      labels: opts.labels
        ? opts.labels.split(",").map((s: string) => s.trim())
        : [],
    });
    console.log(content);
    console.error(chalk.gray(`# source: ${source}`));
  });

/* ── TUI / sync ──────────────────────────────────────────── */

program
  .command("tui")
  .description("Interactive terminal UI for HEXVault")
  .action(async () => {
    const { runTui } = await import("./tui.js");
    await runTui();
  });

program
  .command("sync-export")
  .description("Export memories to a JSON sync bundle")
  .option("-o, --out <file>", "Output file", "hexvault-sync.json")
  .option("-l, --limit <n>", "Max memories", "10000")
  .action(async (opts) => {
    const { exportBundle } = await import("../core/sync/exchange.js");
    const config = loadConfig();
    const engine = new MemoryEngine({
      dbPath: path.resolve(config.memory.path),
    });
    const bundle = exportBundle(engine, {
      limit: parseInt(opts.limit, 10),
      source: "cli",
    });
    engine.close();
    fs.writeFileSync(path.resolve(opts.out), JSON.stringify(bundle, null, 2));
    console.log(
      chalk.green(
        `✓ Exported ${bundle.memories.length} memories → ${opts.out}`,
      ),
    );
  });

program
  .command("sync-import")
  .description("Import memories from a JSON sync bundle")
  .argument("<file>", "Bundle JSON file")
  .action(async (file) => {
    const { importBundle, parseBundle } =
      await import("../core/sync/exchange.js");
    const config = loadConfig();
    const engine = new MemoryEngine({
      dbPath: path.resolve(config.memory.path),
    });
    const raw = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
    const result = importBundle(engine, parseBundle(raw));
    engine.close();
    console.log(
      chalk.green(
        `✓ Import done — added ${result.added}, skipped ${result.skipped}`,
      ),
    );
  });

program.parse();
