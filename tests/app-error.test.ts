import { describe, it, expect } from "vitest";
import { AppError, isAppError } from "../src/core/errors/app-error.js";

describe("AppError", () => {
  it("creates structured error", () => {
    const err = new AppError("CONFIG_INVALID", "bad config", { statusCode: 400 });
    expect(err.code).toBe("CONFIG_INVALID");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("bad config");
    expect(err.name).toBe("AppError");
  });

  it("toJSON returns serializable shape", () => {
    const err = new AppError("PROVIDER_AUTH", "nope", { statusCode: 401 });
    const j = err.toJSON();
    expect(j.code).toBe("PROVIDER_AUTH");
    expect(j.statusCode).toBe(401);
  });

  it("isAppError type guard", () => {
    expect(isAppError(new AppError("CONFIG_INVALID", "x"))).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});
