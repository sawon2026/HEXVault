/**
 * AI feature generators — changelog, docs, architecture explanation,
 * code explanation, dependency analysis, test generation, examples,
 * and issue analysis. Every feature has an LLM path (via LLMRegistry)
 * and a deterministic rule-based fallback so it works without keys.
 */
import { LLMRegistry } from "../llm/registry.js";
import type { LLMMessage } from "../llm/provider.js";
import { log } from "../logging/logger.js";

const logger = log.child("ai-features");

export type FeatureSource = "llm" | "rules";

export interface FeatureResult<T = string> {
  content: T;
  source: FeatureSource;
}

const registry = new LLMRegistry();

async function completeOr<T>(
  messages: LLMMessage[],
  fallback: () => T | Promise<T>,
  opts?: { maxTokens?: number; temperature?: number },
): Promise<FeatureResult<T>> {
  try {
    const res = await registry.complete(messages, {
      maxTokens: opts?.maxTokens ?? 800,
      temperature: opts?.temperature ?? 0.3,
    });
    if (res.model !== "rule-based" && res.content.trim().length > 10) {
      return { content: res.content.trim() as T, source: "llm" };
    }
  } catch (err) {
    logger.warn("AI feature LLM failed — rule fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return { content: await fallback(), source: "rules" };
}

/* ── Changelog ───────────────────────────────────────────── */

export function ruleChangelog(
  version: string,
  items: { type?: string; title: string }[],
): string {
  const sections: Record<string, string[]> = {};
  for (const item of items) {
    const section = classifyItem(item.type || item.title);
    sections[section] = sections[section] || [];
    sections[section].push(item.title);
  }
  const order = [
    "Added",
    "Changed",
    "Fixed",
    "Removed",
    "Security",
    "Maintenance",
  ];
  const lines: string[] = [`## ${version}`, ""];
  for (const s of order) {
    const entries = sections[s];
    if (entries?.length) {
      lines.push(`### ${s}`);
      entries.forEach((e) => lines.push(`- ${e}`));
      lines.push("");
    }
  }
  if (lines.length === 3) lines.push("- Maintenance and internal improvements");
  return lines.join("\n");
}

function classifyItem(input: string): string {
  const t = input.toLowerCase();
  if (
    t.includes("sec") ||
    t.includes("auth") ||
    t.includes("cve") ||
    t.includes("xss")
  )
    return "Security";
  if (
    t.includes("fix") ||
    t.includes("bug") ||
    t.includes("patch") ||
    t.includes("hotfix")
  )
    return "Fixed";
  if (
    t.includes("feat") ||
    t.includes("add") ||
    t.includes("new") ||
    t.includes("implement")
  )
    return "Added";
  if (
    t.includes("remove") ||
    t.includes("drop") ||
    t.includes("delete") ||
    t.includes("deprecat")
  )
    return "Removed";
  if (
    t.includes("refactor") ||
    t.includes("change") ||
    t.includes("upgrade") ||
    t.includes("migrat")
  )
    return "Changed";
  return "Maintenance";
}

export interface ChangelogOptions {
  version: string;
  items: { type?: string; title: string }[];
  projectName?: string;
}

export function generateChangelog(
  opts: ChangelogOptions,
): Promise<FeatureResult> {
  const items = opts.items
    .slice(0, 60)
    .map((i) => `- [${i.type || "chore"}] ${i.title}`);
  return completeOr(
    [
      {
        role: "system",
        content:
          "You maintain a Keep-a-Changelog style CHANGELOG. Sections: Added / Changed / Fixed / Removed / Security / Maintenance. Group items, deduplicate, be concise.",
      },
      {
        role: "user",
        content: `Project: ${opts.projectName || "HEXVault"}\nVersion: ${opts.version}\n\nItems:\n${items.join("\n")}\n\nWrite the changelog section.`,
      },
    ],
    () => ruleChangelog(opts.version, opts.items),
    { maxTokens: 1200 },
  );
}

/* ── Documentation generator ─────────────────────────────── */

export interface DocsGeneratorOptions {
  filePath: string;
  code: string;
  style?: "api-reference" | "how-to" | "overview";
}

export function ruleDocs(opts: DocsGeneratorOptions): string {
  const lines = opts.code.split("\n").filter((l) => l.trim().length > 0);
  const exports = lines
    .filter((l) => /\bexport\s+(class|function|const|interface|type)\b/.test(l))
    .slice(0, 15);
  const name = opts.filePath.split(/[/\\]/).pop() || "module";
  const parts = [
    `# ${name}`,
    "",
    "> Auto-generated overview (rule-based). Provide an LLM API key for richer docs.",
    "",
    "## Public surface",
    "",
  ];
  if (exports.length) {
    exports.forEach((l) =>
      parts.push(`- \`${l.trim().replace(/\s+/g, " ")}\``),
    );
  } else {
    parts.push(
      `- *(no public exports detected — ${lines.length} source lines)*`,
    );
  }
  parts.push(
    "",
    "## Notes",
    "",
    "- Generated from source analysis; verify against implementation.",
  );
  return parts.join("\n");
}

export function generateDocs(
  opts: DocsGeneratorOptions,
): Promise<FeatureResult> {
  return completeOr(
    [
      {
        role: "system",
        content: `You are an expert technical writer. Generate a "${opts.style || "overview"}" style Markdown documentation page for the given source file. Use headings, code fences, and practical examples.`,
      },
      {
        role: "user",
        content: `File: ${opts.filePath}\n\n\`\`\`ts\n${opts.code.slice(0, 8000)}\n\`\`\`\n\nWrite the documentation.`,
      },
    ],
    () => ruleDocs(opts),
    { maxTokens: 1500 },
  );
}

/* ── Architecture explanation ────────────────────────────── */

export function ruleArchitecture(fileTree: string): string {
  const parts = [
    "# Project Architecture",
    "",
    "```",
    fileTree.slice(0, 3000),
    "```",
    "",
    "## Rule-based summary",
    "",
  ];
  const entries = fileTree.split("\n").filter(Boolean);
  const dirs = new Set<string>();
  for (const e of entries) {
    const clean = e.replace(/^[│├└─\s]+/, "").trim();
    const idx = clean.indexOf("/");
    if (idx > 0) dirs.add(clean.slice(0, idx));
  }
  parts.push(`- ${entries.length} paths scanned.`);
  if (dirs.size)
    parts.push(`- Top-level areas: ${[...dirs].slice(0, 12).join(", ")}.`);
  parts.push("- Enable an LLM provider for a narrative architecture review.");
  return parts.join("\n");
}

export function explainArchitecture(fileTree: string): Promise<FeatureResult> {
  return completeOr(
    [
      {
        role: "system",
        content:
          "You are a software architect. Explain the project structure: layers, data flow, key modules, responsibilities, and coupling. Be structured and actionable. Use Markdown.",
      },
      {
        role: "user",
        content: `Project file tree:\n\n${fileTree.slice(0, 6000)}`,
      },
    ],
    () => ruleArchitecture(fileTree),
    { maxTokens: 1500 },
  );
}

/* ── Code explanation ────────────────────────────────────── */

export function ruleExplainCode(code: string): string {
  const lines = code.split("\n");
  const interesting = lines.filter((l) =>
    /\b(export|class|function|const|if|for|async|await|return|import)\b/.test(
      l,
    ),
  );
  return [
    "# Code walkthrough (rule-based)",
    "",
    `Analyzed ${lines.length} lines. Key constructs:`,
    "",
    ...interesting.slice(0, 15).map((l) => `- \`${l.trim().slice(0, 90)}\``),
    "",
    "Enable an LLM provider for a natural-language explanation.",
  ].join("\n");
}

export function explainCode(
  code: string,
  language = "typescript",
): Promise<FeatureResult> {
  return completeOr(
    [
      {
        role: "system",
        content:
          "You are a senior engineer. Explain the provided code: what it does, its inputs/outputs, edge cases, and improvement suggestions. Use Markdown with short sections.",
      },
      {
        role: "user",
        content: `Language: ${language}\n\n\`\`\`${language}\n${code.slice(0, 8000)}\n\`\`\``,
      },
    ],
    () => ruleExplainCode(code),
    { maxTokens: 1200 },
  );
}

/* ── Dependency analyzer ─────────────────────────────────── */

export interface DependencyInfo {
  name: string;
  version: string;
  isDev: boolean;
  optional: boolean;
}

export function analyzeDependencies(
  manifests: Array<{ path: string; json: Record<string, unknown> }>,
): DependencyInfo[] {
  const out: DependencyInfo[] = [];
  for (const manifest of manifests) {
    const deps = (manifest.json.dependencies || {}) as Record<string, string>;
    const dev = (manifest.json.devDependencies || {}) as Record<string, string>;
    const optional = (manifest.json.optionalDependencies || {}) as Record<
      string,
      string
    >;
    for (const [name, version] of Object.entries(deps))
      out.push({ name, version, isDev: false, optional: false });
    for (const [name, version] of Object.entries(dev))
      out.push({ name, version, isDev: true, optional: false });
    for (const [name, version] of Object.entries(optional))
      out.push({ name, version, isDev: false, optional: true });
  }
  return out;
}

export function formatDependencyReport(deps: DependencyInfo[]): string {
  const total = deps.length;
  const prod = deps.filter((d) => !d.isDev && !d.optional).length;
  const dev = deps.filter((d) => d.isDev).length;
  const optional = deps.filter((d) => d.optional).length;
  const latest = deps.slice(0, 40).sort((a, b) => a.name.localeCompare(b.name));

  const lines = [
    `# Dependency Report`,
    ``,
    `- Total: ${total}`,
    `- Production: ${prod}`,
    `- Development: ${dev}`,
    `- Optional: ${optional}`,
    ``,
    `## Production dependencies`,
    ``,
  ];
  for (const d of latest.filter((x) => !x.isDev && !x.optional)) {
    lines.push(`- \`${d.name}@${d.version}\``);
  }
  if (optional) {
    lines.push(
      "",
      "## Optional dependencies (native or platform-specific)",
      "",
    );
    for (const d of latest.filter((x) => x.optional))
      lines.push(`- \`${d.name}@${d.version}\``);
  }
  return lines.join("\n");
}

export function analyzeDependencyReport(
  manifests: Array<{ path: string; json: Record<string, unknown> }>,
  opts?: { review?: boolean },
): Promise<FeatureResult<{ deps: DependencyInfo[]; report: string }>> {
  const deps = analyzeDependencies(manifests);
  const report = formatDependencyReport(deps);
  if (!opts?.review) {
    return Promise.resolve({ content: { deps, report }, source: "rules" });
  }
  return completeOr(
    [
      {
        role: "system",
        content:
          "You review a dependency list for a production project: outdated majors, abandoned packages, security-sensitive packages, and duplicate roles. Be concise and specific.",
      },
      {
        role: "user",
        content: report,
      },
    ],
    () => ({ deps, report }),
    { maxTokens: 900 },
  );
}

/* ── Test generator ──────────────────────────────────────── */

export function ruleGenerateTests(code: string, framework = "vitest"): string {
  const exports: string[] = [];
  const re =
    /\bexport\s+(?:async\s+)?(?:function|class|const)\s+([A-Za-z_$][\w$]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) exports.push(m[1]);
  const target = exports[0] || "moduleExports";
  return [
    `import { describe, it, expect } from "${framework === "jest" ? "@jest/globals" : "vitest"}";`,
    `import { ${target} } from "./${guessModuleName(code)}";`,
    "",
    `describe("${target}", () => {`,
    `  it("exists", () => {`,
    `    expect(typeof ${target}).toBe("function");`,
    `  });`,
    `});`,
    "",
    `// TODO: replace placeholders with behavior-focused cases once the API is known.`,
  ].join("\n");
}

function guessModuleName(_code: string): string {
  return "module";
}

export function generateTests(
  code: string,
  opts?: { framework?: "vitest" | "jest" | "node:test" },
): Promise<FeatureResult> {
  const framework = opts?.framework || "vitest";
  return completeOr(
    [
      {
        role: "system",
        content: `You write unit tests for the given source in ${framework}. Cover main paths and edge cases. Return only valid test code.`,
      },
      {
        role: "user",
        content: `\`\`\`ts\n${code.slice(0, 8000)}\n\`\`\`\n\nWrite tests.`,
      },
    ],
    () => ruleGenerateTests(code, framework),
    { maxTokens: 1500 },
  );
}

/* ── Examples generator ──────────────────────────────────── */

export function ruleGenerateExamples(code: string): string {
  return [
    "# Usage examples (rule-based)",
    "",
    "```ts",
    "// 1) Import the module",
    `import * as mod from "./${guessModuleName(code)}";`,
    "",
    "// 2) Inspect the public API",
    "console.log(Object.keys(mod));",
    "",
    "// 3) Call the documented entry points with realistic inputs",
    "// (rule-based examples require an LLM provider for real usage snippets)",
    "```",
  ].join("\n");
}

export function generateExamples(
  code: string,
  context?: string,
): Promise<FeatureResult> {
  return completeOr(
    [
      {
        role: "system",
        content:
          "You write realistic usage examples for the given source: imports, constructor/config options, and typical call sequences with expected outputs. Return only code.",
      },
      {
        role: "user",
        content: `${context ? `Context: ${context}\n\n` : ""}\`\`\`ts\n${code.slice(0, 8000)}\n\`\`\`\n\nWrite examples.`,
      },
    ],
    () => ruleGenerateExamples(code),
    { maxTokens: 1200 },
  );
}

/* ── Issue analysis ──────────────────────────────────────── */

export interface IssueAnalysisInput {
  title: string;
  body?: string;
  labels?: string[];
}

export function ruleAnalyzeIssue(issue: IssueAnalysisInput): string {
  const text = `${issue.title} ${issue.body || ""}`.toLowerCase();
  const hints: string[] = [];
  if (/\bbug|error|crash|broken|fails?\b/.test(text))
    hints.push("Possible bug report");
  if (/\bsec|auth|token|password|inject|ssrf|deseriali/.test(text))
    hints.push("Security-sensitive area");
  if (/\bperf|slow|latency|memory leak\b/.test(text))
    hints.push("Performance concern");
  if (/\bcrash|stack trace|exception\b/.test(text))
    hints.push("Crash / exception reported");
  if (/\bhow do i|help|guide|step\b/.test(text))
    hints.push("Support / usage question");
  if (/\bapi|endpoint|schema\b/.test(text)) hints.push("API surface involved");
  return [
    `# Issue analysis: ${issue.title}`,
    "",
    `Labels: ${issue.labels?.length ? issue.labels.join(", ") : "none"}`,
    "",
    ...hints.map((h) => `- ${h}`),
    "",
    "Suggested next steps (rule-based):",
    "",
    "1. Reproduce with a minimal script",
    '2. Check related memories (`hexvault search "<keywords>"`)',
    "3. Enable an LLM provider for a deeper diagnosis",
  ].join("\n");
}

export function analyzeIssue(
  issue: IssueAnalysisInput,
): Promise<FeatureResult> {
  return completeOr(
    [
      {
        role: "system",
        content:
          "You analyze a GitHub/GitLab issue: classify it (bug/feature/question/security), estimate affected areas, suggest investigation steps, and propose a fix approach. Structured Markdown.",
      },
      {
        role: "user",
        content: `Title: ${issue.title}\nLabels: ${(issue.labels || []).join(", ") || "none"}\nBody:\n${(issue.body || "").slice(0, 4000)}`,
      },
    ],
    () => ruleAnalyzeIssue(issue),
    { maxTokens: 1000 },
  );
}

export { classifyItem };
