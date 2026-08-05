/**
 * Structured logger for HEXVault.
 * Levels: debug | info | warn | error
 * Output: JSON lines when HEXVAULT_LOG_JSON=1, else human-readable.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function envLevel(): LogLevel {
  const v = (process.env.HEXVAULT_LOG_LEVEL || "info").toLowerCase();
  if (v === "debug" || v === "info" || v === "warn" || v === "error") return v;
  return "info";
}

export class Logger {
  constructor(
    private scope: string,
    private minLevel: LogLevel = envLevel(),
  ) {}

  child(scope: string): Logger {
    return new Logger(`${this.scope}:${scope}`, this.minLevel);
  }

  private should(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  private emit(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ) {
    if (!this.should(level)) return;
    const ts = new Date().toISOString();
    if (process.env.HEXVAULT_LOG_JSON === "1") {
      const line = JSON.stringify({
        ts,
        level,
        scope: this.scope,
        message,
        ...meta,
      });
      console.log(line);
      return;
    }
    const prefix = `[${ts}] ${level.toUpperCase()} [${this.scope}]`;
    const extra = meta ? ` ${JSON.stringify(meta)}` : "";
    console.log(`${prefix} ${message}${extra}`);
  }

  debug(msg: string, meta?: Record<string, unknown>) {
    this.emit("debug", msg, meta);
  }
  info(msg: string, meta?: Record<string, unknown>) {
    this.emit("info", msg, meta);
  }
  warn(msg: string, meta?: Record<string, unknown>) {
    this.emit("warn", msg, meta);
  }
  error(msg: string, meta?: Record<string, unknown>) {
    this.emit("error", msg, meta);
  }
}

/** Root logger */
export const log = new Logger("hexvault");
