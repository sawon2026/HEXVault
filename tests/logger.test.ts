import { describe, it, expect } from "vitest";
import { Logger, log } from "../src/core/logging/logger.js";

describe("Logger", () => {
  it("creates child scopes", () => {
    const child = log.child("test-scope");
    expect(child).toBeInstanceOf(Logger);
  });

  it("emits without throwing", () => {
    const l = new Logger("unit", "debug");
    expect(() => {
      l.debug("d");
      l.info("i");
      l.warn("w");
      l.error("e", { code: 1 });
    }).not.toThrow();
  });
});
