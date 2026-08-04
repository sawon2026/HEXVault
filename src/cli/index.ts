#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import path from "path";
import fs from "fs";
import { MemoryStore } from "../core/memory/store.js";
import { MemoryEngine } from "../core/memory/engine.js";
import { loadConfig, createDefaultConfig } from "../config/index.js";
import { ReviewEngine } from "../core/review/reviewer.js";
import { generateCommitMessage, generateReleaseNotes } from "../core/ai/generators.js";
import { repoChat } from "../core/ai/repo-chat.js";

const program = new Command();

program
  .name("hexvault")
  .description("HEXVault — Intelligent Project Memory + Smart PR Reviewer")
  .version("1.2.1");

program
  .command("init")
  .description("Initialize HEXVault in the current project")
  .action(() => {
    const cwd = process.cwd();
    const created = createDefaultConfig(cwd);
    const memDir = path.join(cwd, ".hexvault");
    if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });
    const config = loadConfig(cwd);
    const store = new MemoryStore({ dbPath: path.join(cwd, config.memory.path) });
    store.close();
    console.log(chalk.green("✓ HEXVault initialized!"));
    if (created) console.log(chalk.gray("  Created .hexvault.yml"));
    console.log(chalk.gray("  Created .hexvault/memory.db"));
  });

program
  .command("add <content>")
  .description("Add a new memory entry")
  .option("-t, --type <type>", "Memory type", "note")
  .option("--title <title>", "Title for the memory")
  .option("--tags <tags>", "Comma separated tags")
  .option("--files <files>", "Comma separated related files")
  .action((content, opts) => {
    const config = loadConfig();
    const store = new MemoryStore({ dbPath: path.resolve(config.memory.path) });
    const title = opts.title || content.slice(0, 60);
    const tags = opts.tags ? opts.tags.split(",").map((t: string) => t.trim()) : [];
    const files = opts.files ? opts.files.split(",").map((f: string) => f.trim()) : [];
    const entry = store.add(title, content, { type: opts.type, tags, files, source: "manual" });
    store.close();
    console.log(chalk.green("✓ Memory added"));
    console.log(chalk.gray(`  ID: ${entry.id}`));
  });

program
  .command("search <query>")
  .description("Search project memories")
  .option("-l, --limit <n>", "Max results", "10")
  .action((query, opts) => {
    const config = loadConfig();
    const store = new MemoryStore({ dbPath: path.resolve(config.memory.path) });
    const results = store.search(query, parseInt(opts.limit, 10));
    store.close();
    if (!results.length) return console.log(chalk.yellow("No memories found."));
    for (const r of results) {
      console.log(chalk.cyan(`[${r.entry.type}]`) + " " + chalk.bold(r.entry.title));
      console.log(chalk.gray(`  ${r.entry.content.slice(0, 120)}`));
    }
  });

program
  .command("list")
  .description("List recent memories")
  .option("-t, --type <type>", "Filter by type")
  .option("-l, --limit <n>", "Max results", "20")
  .action((opts) => {
    const config = loadConfig();
    const store = new MemoryStore({ dbPath: path.resolve(config.memory.path) });
    const entries = store.list(parseInt(opts.limit, 10), opts.type);
    store.close();
    for (const e of entries) {
      console.log(chalk.cyan(`[${e.type}]`) + " " + chalk.bold(e.title));
    }
  });

program
  .command("stats")
  .description("Show memory statistics")
  .action(() => {
    const config = loadConfig();
    const store = new MemoryStore({ dbPath: path.resolve(config.memory.path) });
    const stats = store.stats();
    store.close();
    console.log(`Total memories: ${chalk.green(stats.total)}`);
  });

program
  .command("review")
  .description("Run a local review (demo mode)")
  .option("--title <title>", "PR title", "Demo PR")
  .option("--body <body>", "PR body", "")
  .action(async (opts) => {
    const config = loadConfig();
    const store = new MemoryStore({ dbPath: path.resolve(config.memory.path) });
    const memories = store.list(10);
    store.close();
    const engine = new ReviewEngine(config.review);
    const result = await engine.review(opts.title, opts.body, "+ demo", memories);
    console.log(result.summary);
    console.log("Score:", result.score);
  });

program
  .command("commit-msg")
  .description("Generate a conventional commit message")
  .argument("[input]", "Change summary")
  .option("-f, --file <path>", "Read diff/summary from file")
  .action(async (input, opts) => {
    let text = input || "";
    if (opts.file) text = fs.readFileSync(path.resolve(opts.file), "utf8");
    if (!text.trim()) {
      console.error(chalk.red("Provide a summary or --file"));
      process.exit(1);
    }
    const { message, source } = await generateCommitMessage({ input: text });
    console.log(message);
    console.error(chalk.gray(`# source: ${source}`));
  });

program
  .command("release-notes")
  .description("Generate Markdown release notes")
  .requiredOption("-v, --version <ver>", "Version e.g. v1.2.0")
  .option("-i, --items <list>", "Comma-separated items")
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
      items = opts.items.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    if (!items.length) items = ["General improvements"];
    const { notes, source } = await generateReleaseNotes({
      version: opts.version,
      items,
      projectName: "HEXVault",
    });
    console.log(notes);
    console.error(chalk.gray(`# source: ${source}`));
  });

program
  .command("ask")
  .description("Ask a question against project memories (RAG)")
  .argument("<question>", "Your question")
  .action(async (question) => {
    const config = loadConfig();
    const engine = new MemoryEngine({ dbPath: path.resolve(config.memory.path) });
    const result = await repoChat({ engine, question });
    engine.close();
    console.log(chalk.bold("\nHEXVault Answer\n"));
    console.log(result.answer);
    if (result.sources.length) {
      console.log(chalk.gray("\nSources:"));
      for (const s of result.sources.slice(0, 5)) {
        console.log(chalk.gray(`  - [${s.type}] ${s.title}`));
      }
    }
  });

program
  .command("analyze")
  .description("Complexity + dead-code heuristics")
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
          `  ${chalk.yellow(String(h.score).padStart(3))}  ${h.file}  (lines=${h.lines}, cyclo≈${h.cyclomaticApprox})`
        );
      }
    }
    const serious = report.deadCode.filter((d) =>
      ["debugger", "empty-catch", "unused-export"].includes(d.kind)
    );
    if (serious.length) {
      console.log(chalk.bold("\nNotable hints:\n"));
      for (const d of serious.slice(0, 15)) {
        console.log(`  ${d.file}:${d.line}  [${d.kind}] ${d.symbol}`);
      }
    }
  });

program.parse();
