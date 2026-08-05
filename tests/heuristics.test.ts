import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { analyzeProject } from "../src/core/analysis/heuristics.js";

describe("heuristics", () => {
  it("scores files and finds hints", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hex-an-"));
    const src = path.join(dir, "src");
    fs.mkdirSync(src);
    fs.writeFileSync(
      path.join(src, "sample.ts"),
      `
export function heavy(a: number) {
  if (a > 0) {
    if (a > 1) {
      while (a > 0) {
        a--;
        console.log(a);
      }
    }
  }
  try {} catch (e) {}
  debugger;
  return a;
}
export const neverUsedHere = 1;
`,
    );
    const report = await analyzeProject({ cwd: dir, topN: 5 });
    fs.rmSync(dir, { recursive: true, force: true });
    expect(report.filesScanned).toBeGreaterThanOrEqual(1);
    expect(report.complexity[0].score).toBeGreaterThan(0);
    expect(report.deadCode.some((d) => d.kind === "debugger")).toBe(true);
  });
});
