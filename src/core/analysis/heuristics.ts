/**
 * Static heuristics — complexity signals + likely dead code.
 */
import fs from "fs";
import path from "path";
import fg from "fast-glob";

export interface FileComplexity {
  file: string;
  lines: number;
  functions: number;
  maxNesting: number;
  cyclomaticApprox: number;
  score: number;
}

export interface DeadCodeHint {
  file: string;
  symbol: string;
  kind: "unused-export" | "todo-fixme" | "empty-catch" | "debugger" | "console-debug";
  line: number;
  detail: string;
}

export interface AnalysisReport {
  root: string;
  filesScanned: number;
  complexity: FileComplexity[];
  hotspots: FileComplexity[];
  deadCode: DeadCodeHint[];
  summary: { avgScore: number; maxScore: number; deadHints: number };
}

const DEFAULT_GLOBS = [
  "src/**/*.{ts,tsx,js,jsx,mjs,cjs}",
  "!**/node_modules/**",
  "!**/dist/**",
  "!**/*.test.*",
  "!**/*.spec.*",
];

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

function approxNesting(text: string): number {
  let depth = 0;
  let max = 0;
  for (const ch of text) {
    if (ch === "{") {
      depth++;
      if (depth > max) max = depth;
    } else if (ch === "}") depth = Math.max(0, depth - 1);
  }
  return max;
}

function scoreFile(file: string, text: string): FileComplexity {
  const lines = text.split(/\n/).length;
  const functions = countMatches(
    text,
    /\bfunction\b|\b=>\s*\{|^\s*(async\s+)?[a-zA-Z_$][\w$]*\s*\([^)]*\)\s*\{/gm
  );
  const branches = countMatches(
    text,
    /\b(if|else if|switch|case|for|while|\|\||&&|\?)\b/g
  );
  const maxNesting = approxNesting(text);
  const cyclomaticApprox = 1 + branches;
  const raw =
    Math.min(lines / 8, 40) +
    Math.min(cyclomaticApprox * 1.5, 35) +
    Math.min(maxNesting * 3, 15) +
    Math.min(functions * 0.5, 10);
  return {
    file: file.replace(/\\/g, "/"),
    lines,
    functions,
    maxNesting,
    cyclomaticApprox,
    score: Math.round(Math.min(100, raw)),
  };
}

function scanDeadHints(file: string, text: string): DeadCodeHint[] {
  const hints: DeadCodeHint[] = [];
  const lines = text.split(/\n/);
  const rel = file.replace(/\\/g, "/");

  lines.forEach((line, idx) => {
    const n = idx + 1;
    if (/\bdebugger\b/.test(line)) {
      hints.push({ file: rel, symbol: "debugger", kind: "debugger", line: n, detail: line.trim().slice(0, 80) });
    }
    if (/\bconsole\.(log|debug|info)\s*\(/.test(line) && !/eslint-disable/.test(line)) {
      hints.push({ file: rel, symbol: "console", kind: "console-debug", line: n, detail: line.trim().slice(0, 80) });
    }
    if (/\bTODO\b|\bFIXME\b|\bHACK\b/.test(line)) {
      hints.push({ file: rel, symbol: "todo", kind: "todo-fixme", line: n, detail: line.trim().slice(0, 80) });
    }
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line) || /catch\s*\{\s*\}/.test(line)) {
      hints.push({ file: rel, symbol: "catch", kind: "empty-catch", line: n, detail: "Empty catch block" });
    }
  });

  const exportRe = /export\s+(?:async\s+)?(?:function|const|class|let)\s+([A-Za-z_$][\w$]*)/g;
  let m: RegExpExecArray | null;
  while ((m = exportRe.exec(text))) {
    const name = m[1];
    if (name === "default") continue;
    const refs = countMatches(text, new RegExp(`\\b${name}\\b`, "g"));
    if (refs <= 1) {
      const line = text.slice(0, m.index).split(/\n/).length;
      hints.push({
        file: rel,
        symbol: name,
        kind: "unused-export",
        line,
        detail: `Exported "${name}" not referenced in this file`,
      });
    }
  }
  return hints;
}

export interface AnalyzeOptions {
  cwd?: string;
  globs?: string[];
  topN?: number;
}

export async function analyzeProject(opts: AnalyzeOptions = {}): Promise<AnalysisReport> {
  const root = opts.cwd || process.cwd();
  const files = await fg(opts.globs || DEFAULT_GLOBS, {
    cwd: root,
    absolute: true,
    onlyFiles: true,
  });

  const complexity: FileComplexity[] = [];
  const deadCode: DeadCodeHint[] = [];

  for (const abs of files) {
    let text: string;
    try {
      text = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (text.length > 500_000) continue;
    const rel = path.relative(root, abs);
    complexity.push(scoreFile(rel, text));
    deadCode.push(...scanDeadHints(rel, text));
  }

  complexity.sort((a, b) => b.score - a.score);
  const topN = opts.topN ?? 15;
  const hotspots = complexity.filter((c) => c.score >= 40).slice(0, topN);
  const avgScore =
    complexity.length === 0
      ? 0
      : Math.round(complexity.reduce((s, c) => s + c.score, 0) / complexity.length);

  return {
    root,
    filesScanned: complexity.length,
    complexity,
    hotspots,
    deadCode: deadCode.slice(0, 100),
    summary: {
      avgScore,
      maxScore: complexity[0]?.score ?? 0,
      deadHints: deadCode.length,
    },
  };
}
