/**
 * SQLite adapter — single source of truth for database access.
 *
 * Primary driver: `node:sqlite` (DatabaseSync) — built into Node.js >= 22.5,
 * zero native dependencies, no build toolchain required.
 *
 * Fallback driver: `better-sqlite3` (optionalDependency) — for Node 18-22.4
 * environments where the native module can be installed.
 *
 * Both drivers expose a synchronous API, so this adapter keeps a synchronous
 * `openDatabaseSync` surface — zero changes needed at existing call sites.
 */

import { createRequire } from "module";
import { AppError } from "../errors/app-error.js";
import { log } from "../logging/logger.js";

const require = createRequire(import.meta.url);
const logger = log.child("sqlite-adapter");

export type SqliteParams = string | number | bigint | Uint8Array | null;
export type SqliteRow = Record<string, unknown>;

export interface SqliteStatement {
  /** Run the statement with params (insert/update/delete) */
  run(...params: SqliteParams[]): { changes: number };
  /** Fetch the first row */
  get(...params: SqliteParams[]): SqliteRow | undefined;
  /** Fetch all rows */
  all(...params: SqliteParams[]): SqliteRow[];
}

export interface SqliteDatabase {
  readonly driver: "node:sqlite" | "better-sqlite3";
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

/** Minimal structural type both drivers satisfy. */
interface RawDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number | bigint };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  close(): void;
}

/** Wrap either driver behind the adapter interface. */
function wrap(
  driver: "node:sqlite" | "better-sqlite3",
  db: RawDatabase,
): SqliteDatabase {
  return {
    driver,
    exec: (sql) => db.exec(sql),
    prepare: (sql) => {
      const stmt = db.prepare(sql);
      return {
        run: (...params) => {
          const res = stmt.run(...params);
          return { changes: Number(res.changes ?? 0) };
        },
        get: (...params) => {
          const row = stmt.get(...params);
          return row === undefined || row === null
            ? undefined
            : (row as SqliteRow);
        },
        all: (...params) => {
          const rows = stmt.all(...params);
          return rows as SqliteRow[];
        },
      };
    },
    close: () => db.close(),
  };
}

/**
 * Open a SQLite database synchronously.
 * Prefers node:sqlite (Node >= 22.5); falls back to better-sqlite3.
 * Throws AppError("MEMORY_STORE") if neither driver is available.
 */
export function openDatabaseSync(
  dbPath: string,
  opts?: { allowFallback?: boolean },
): SqliteDatabase {
  const allowFallback = opts?.allowFallback !== false;

  // 1) Primary: node:sqlite built-in (Node >= 22.5)
  try {
    const sqlite = require("node:sqlite") as {
      DatabaseSync: new (path: string) => RawDatabase;
    };
    const db = new sqlite.DatabaseSync(dbPath);
    return wrap("node:sqlite", db);
  } catch (primaryErr) {
    if (!allowFallback) {
      throw new AppError(
        "MEMORY_STORE",
        "node:sqlite unavailable on this Node version",
        {
          details: { node: process.version },
          cause: primaryErr,
        },
      );
    }
    logger.warn(
      "node:sqlite unavailable — falling back to better-sqlite3 (optionalDependency for Node < 22.5)",
      {
        error:
          primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
      },
    );
  }

  // 2) Fallback: better-sqlite3 (needs native build toolchain)
  try {
    const better = require("better-sqlite3") as (path: string) => RawDatabase;
    return wrap("better-sqlite3", better(dbPath));
  } catch (fallbackErr) {
    throw new AppError("MEMORY_STORE", "No usable SQLite driver found", {
      details: {
        node: process.version,
        hint: "Use Node.js >= 22.5, or install better-sqlite3 (requires a native build toolchain)",
        primaryError: primaryErrMessage(),
        fallbackError:
          fallbackErr instanceof Error
            ? fallbackErr.message
            : String(fallbackErr),
      },
    });
  }
}

function primaryErrMessage(): string {
  return "node:sqlite require failed";
}

/** Whether the platform has a usable built-in SQLite driver. */
export function hasNodeSqlite(): boolean {
  try {
    const major = Number(process.versions.node?.split(".")[0] || 0);
    return major >= 22;
  } catch {
    return false;
  }
}
