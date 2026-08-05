/**
 * Interactive TUI — zero extra deps (readline + chalk).
 * Cross-platform (Windows PowerShell, macOS, Linux).
 */
import readline from "readline";
import chalk from "chalk";
import path from "path";
import { loadConfig } from "../config/index.js";
import { MemoryEngine } from "../core/memory/engine.js";
import { repoChat } from "../core/ai/repo-chat.js";
import { analyzeProject } from "../core/analysis/heuristics.js";
import { generateCommitMessage } from "../core/ai/generators.js";

function rl(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(iface: readline.Interface, q: string): Promise<string> {
  return new Promise((resolve) => {
    iface.question(q, (ans) => resolve((ans || "").trim()));
  });
}

function banner() {
  console.clear();
  console.log(
    chalk.cyan.bold(`
  ██╗  ██╗███████╗██╗  ██╗██╗   ██╗ █████╗ ██╗   ██╗██╗  ████████╗
  ██║  ██║██╔════╝╚██╗██╔╝██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝
  ███████║█████╗   ╚███╔╝ ██║   ██║███████║██║   ██║██║     ██║
  ██╔══██║██╔══╝   ██╔██╗ ╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║
  ██║  ██║███████╗██╔╝ ██╗ ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║
  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝
`),
  );
  console.log(
    chalk.gray("  Interactive Project Memory · type a number + Enter\n"),
  );
}

function menu() {
  const items = [
    ["1", "List recent memories"],
    ["2", "Search memories"],
    ["3", "Add memory"],
    ["4", "Stats"],
    ["5", "Ask (RAG chat)"],
    ["6", "Analyze codebase"],
    ["7", "Commit message helper"],
    ["0", "Exit"],
  ];
  for (const [k, label] of items) {
    console.log(`  ${chalk.cyan(k)}  ${label}`);
  }
  console.log();
}

function engine(): MemoryEngine {
  const config = loadConfig();
  return new MemoryEngine({
    dbPath: path.resolve(config.memory.path),
  });
}

async function listMemories() {
  const e = engine();
  const items = e.list(15);
  e.close();
  if (!items.length) {
    console.log(chalk.yellow("\n  No memories yet.\n"));
    return;
  }
  console.log(chalk.bold(`\n  ${items.length} recent memories\n`));
  for (const m of items) {
    console.log(
      `  ${chalk.magenta(`[${m.type}]`)} ${chalk.white(m.title)} ${chalk.gray(m.createdAt?.slice(0, 10) || "")}`,
    );
  }
  console.log();
}

async function searchMemories(iface: readline.Interface) {
  const q = await ask(iface, chalk.cyan("  Query › "));
  if (!q) return;
  const e = engine();
  const hits = e.hybridSearch(q, 10);
  e.close();
  if (!hits.length) {
    console.log(chalk.yellow("\n  No matches.\n"));
    return;
  }
  console.log(chalk.bold(`\n  ${hits.length} results\n`));
  for (const h of hits) {
    console.log(
      `  ${chalk.cyan(h.rankScore.toFixed(2))} ${chalk.magenta(`[${h.entry.type}]`)} ${h.entry.title}`,
    );
    console.log(chalk.gray(`         ${h.entry.content.slice(0, 90)}`));
  }
  console.log();
}

async function addMemory(iface: readline.Interface) {
  const content = await ask(iface, chalk.cyan("  Content › "));
  if (!content) return;
  const type =
    (await ask(
      iface,
      chalk.cyan("  Type [note/decision/bugfix/architecture/security] › "),
    )) || "note";
  const tagsRaw = await ask(iface, chalk.cyan("  Tags (comma) › "));
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const e = engine();
  const entry = e.add(content.slice(0, 60), content, {
    type: type as never,
    tags,
    source: "tui",
  });
  e.close();
  console.log(chalk.green(`\n  ✓ Added ${entry.id}\n`));
}

async function showStats() {
  const e = engine();
  const s = e.stats();
  e.close();
  console.log(chalk.bold("\n  Stats\n"));
  console.log(`  Total: ${chalk.green(String(s.total))}`);
  for (const [t, n] of Object.entries(s.byType || {})) {
    console.log(`  ${t}: ${n}`);
  }
  console.log();
}

async function askChat(iface: readline.Interface) {
  const q = await ask(iface, chalk.cyan("  Question › "));
  if (!q) return;
  const e = engine();
  console.log(chalk.gray("\n  Thinking…\n"));
  const result = await repoChat({ engine: e, question: q });
  e.close();
  console.log(chalk.bold("  Answer\n"));
  console.log(`  ${result.answer.split("\n").join("\n  ")}\n`);
  if (result.sources?.length) {
    console.log(chalk.gray("  Sources:"));
    for (const s of result.sources.slice(0, 5)) {
      console.log(chalk.gray(`    · [${s.type}] ${s.title}`));
    }
    console.log();
  }
}

async function runAnalyze() {
  console.log(chalk.gray("\n  Scanning…\n"));
  const report = await analyzeProject({ cwd: process.cwd(), topN: 10 });
  console.log(`  Files: ${report.filesScanned}`);
  console.log(`  Avg complexity: ${report.summary.avgScore}/100`);
  console.log(`  Max: ${report.summary.maxScore}/100`);
  console.log(`  Hints: ${report.summary.deadHints}`);
  if (report.hotspots.length) {
    console.log(chalk.bold("\n  Hotspots"));
    for (const h of report.hotspots.slice(0, 8)) {
      console.log(`  ${chalk.yellow(String(h.score).padStart(3))}  ${h.file}`);
    }
  }
  console.log();
}

async function commitHelper(iface: readline.Interface) {
  const input = await ask(iface, chalk.cyan("  Change summary › "));
  if (!input) return;
  const { message, source } = await generateCommitMessage({ input });
  console.log(chalk.green(`\n  ${message}`));
  console.log(chalk.gray(`  (source: ${source})\n`));
}

export async function runTui(): Promise<void> {
  const iface = rl();
  banner();
  menu();

  while (true) {
    const choice = await ask(iface, chalk.cyan("  HEXVault › "));
    console.log();
    try {
      switch (choice) {
        case "1":
          await listMemories();
          break;
        case "2":
          await searchMemories(iface);
          break;
        case "3":
          await addMemory(iface);
          break;
        case "4":
          await showStats();
          break;
        case "5":
          await askChat(iface);
          break;
        case "6":
          await runAnalyze();
          break;
        case "7":
          await commitHelper(iface);
          break;
        case "0":
        case "q":
        case "quit":
        case "exit":
          console.log(chalk.gray("  Bye.\n"));
          iface.close();
          return;
        case "h":
        case "help":
        case "":
          menu();
          break;
        default:
          console.log(
            chalk.yellow("  Unknown — press Enter for menu, 0 to exit\n"),
          );
          menu();
      }
    } catch (err) {
      console.log(
        chalk.red(
          `  Error: ${err instanceof Error ? err.message : String(err)}\n`,
        ),
      );
    }
  }
}
