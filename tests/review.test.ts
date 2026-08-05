import { describe, it, expect } from "vitest";
import { ReviewEngine } from "../src/core/review/reviewer.js";

describe("ReviewEngine", () => {
  it("reviews a demo diff", async () => {
    const engine = new ReviewEngine({
      model: "rule-based",
      severity: "medium",
      checks: ["security", "consistency", "best-practices"],
    });
    const result = await engine.review(
      "Add logging",
      "Improves observability",
      "+ console.log('x')\n- // old",
      [],
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.summary).toBeTruthy();
  });
});
