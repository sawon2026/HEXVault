#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import path from "path";
import fs from "fs";
import { MemoryStore } from "../core/memory/store.js";
import { loadConfig, createDefaultConfig } from "../config/index.js";
import { ReviewEngine } from "../core/review/reviewer.js";

const program = new Command();

program
  .name("hexvault")
  .description("HEXVault — Intelligent Project Memory + Smart PR Reviewer")
  .version("0.1.0");

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

    // Create empty db by instantiating store
    const config = loadConfig(cwd);
    const store = new MemoryStore({ dbPath: path.join(cwd, config.memory.path) });
    store.close();

    console.log(chalk.green("✓ HEXVault initialized!"));
    if (created) {
      console.log(chalk.gray("  Created .hexvault.yml"));
    }
    console.log(chalk.gray("  Created .hexvault/memory.db"));
    console.log();
    console.log("Next steps:");
    console.log(chalk.cyan("  hexvault add \"We decided to use SQLite for local storage\" --type decision"));
    console.log(chalk.cyan("  hexvault search \"database\""));
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
    const store = new MemoryStore({
      dbPath: path.resolve(config.memory.path),
    });

    const title = opts.title || content.slice(0, 60);
    const tags = opts.tags ? opts.tags.split(",").map((t: string) => t.trim()) : [];
    const files = opts.files ? opts.files.split(",").map((f: string) => f.trim()) : [];

    const entry = store.add(title, content, {
      type: opts.type,
      tags,
      files,
      source: "manual",
    });

    store.close();

    console.log(chalk.green("✓ Memory added"));
    console.log(chalk.gray(`  ID: ${entry.id}`));
    console.log(chalk.gray(`  Type: ${entry.type}`));
    console.log(chalk.gray(`  Title: ${entry.title}`));
  });

program
  .command("search <query>")
  .description("Search project memories")
  .option("-l, --limit <n>", "Max results", "10")
  .action((query, opts) => {
    const config = loadConfig();
    const store = new MemoryStore({
      dbPath: path.resolve(config.memory.path),
    });

    const results = store.search(query, parseInt(opts.limit, 10));
    store.close();

    if (results.length === 0) {
      console.log(chalk.yellow("No memories found."));
      return;
    }

    console.log(chalk.bold(`\nFound ${results.length} memories:\n`));
    for (const r of results) {
      console.log(chalk.cyan(`[${r.entry.type}]`) + " " + chalk.bold(r.entry.title));
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
  .action((opts) => {
    const config = loadConfig();
    const store = new MemoryStore({
      dbPath: path.resolve(config.memory.path),
    });

    const entries = store.list(parseInt(opts.limit, 10), opts.type);
    store.close();

    if (entries.length === 0) {
      console.log(chalk.yellow("No memories yet. Use `hexvault add` to create some."));
      return;
    }

    console.log(chalk.bold(`\nRecent memories (${entries.length}):\n`));
    for (const e of entries) {
      console.log(
        chalk.cyan(`[${e.type}]`) +
          " " +
          chalk.bold(e.title) +
          chalk.gray(`  (${e.createdAt.slice(0, 10)})`)
      );
    }
  });

program
  .command("stats")
  .description("Show memory statistics")
  .action(() => {
    const config = loadConfig();
    const store = new MemoryStore({
      dbPath: path.resolve(config.memory.path),
    });

    const stats = store.stats();
    store.close();

    console.log(chalk.bold("\nHEXVault Stats\n"));
    console.log(`Total memories: ${chalk.green(stats.total)}`);
    console.log("\nBy type:");
    for (const [type, count] of Object.entries(stats.byType)) {
      console.log(`  ${type}: ${count}`);
    }
  });

program
  .command("review")
  .description("Run a local review (demo mode)")
  .option("--title <title>", "PR title", "Demo PR")
  .option("--body <body>", "PR body", "")
  .action(async (opts) => {
    const config = loadConfig();
    const store = new MemoryStore({
      dbPath: path.resolve(config.memory.path),
    });

    const memories = store.list(10);
    store.close();

    const engine = new ReviewEngine(config.review);
    const result = await engine.review(
      opts.title,
      opts.body,
      "+ console.log('hello')\n- console.log('old')",
      memories
    );

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

program.parse();
