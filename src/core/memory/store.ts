/**
 * MemoryStore — durable project memory persisted in SQLite.
 *
 * Uses the platform SQLite adapter (node:sqlite >= Node 22.5, better-sqlite3
 * fallback) so installs never require a native build toolchain.
 *
 * Schema v2:
 *  - `importance`   0..1 score used by ranking (defaulted from type)
 *  - `ttl_expires`  ISO timestamp; null = never expires
 *  - `embedding`    persisted JSON vector (cache for semantic search)
 *  - `category`     free-form category grouping
 *  - `links`        JSON array of { kind, id, label } (repo / workspace / conversation)
 */
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import type {
  MemoryEntry,
  MemoryType,
  MemorySearchResult,
  MemoryStoreOptions,
  IngestOptions,
} from "./types.js";
import { openDatabaseSync, type SqliteDatabase } from "../db/sqlite.js";

export interface MemoryLink {
  kind: "repository" | "workspace" | "conversation" | "commit" | "issue" | "pr";
  id: string;
  label?: string;
}

export class MemoryStore {
  private db: SqliteDatabase;
  private dbPath: string;

  constructor(options: MemoryStoreOptions) {
    this.dbPath = options.dbPath;
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = openDatabaseSync(this.dbPath);
    try {
      this.db.exec("PRAGMA journal_mode = WAL");
    } catch {
      // in-memory or read-only media: WAL not available, continue
    }
    this.initSchema();
    this.migrateV1();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        files TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        source TEXT,
        category TEXT,
        importance REAL NOT NULL DEFAULT 0.5,
        ttl_expires TEXT,
        embedding TEXT,
        links TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
      CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
      CREATE INDEX IF NOT EXISTS idx_memories_ttl ON memories(ttl_expires);
    `);
  }

  /**
   * v1 -> v2 migration: add columns introduced after the original schema.
   * Uses ALTER TABLE ... ADD COLUMN guarded by a PRAGMA table_info check so
   * existing databases upgrade in place without data loss.
   */
  private migrateV1() {
    const cols = new Set(
      (
        this.db.prepare("PRAGMA table_info(memories)").all() as {
          name: string;
        }[]
      ).map((c) => c.name),
    );
    const stmts: Record<string, string> = {
      category: `ALTER TABLE memories ADD COLUMN category TEXT`,
      importance: `ALTER TABLE memories ADD COLUMN importance REAL NOT NULL DEFAULT 0.5`,
      ttl_expires: `ALTER TABLE memories ADD COLUMN ttl_expires TEXT`,
      embedding: `ALTER TABLE memories ADD COLUMN embedding TEXT`,
      links: `ALTER TABLE memories ADD COLUMN links TEXT NOT NULL DEFAULT '[]'`,
    };
    for (const [col, sql] of Object.entries(stmts)) {
      if (!cols.has(col)) {
        try {
          this.db.exec(sql);
        } catch {
          // column exists via a newer schema — ignore
        }
      }
    }
  }

  add(
    title: string,
    content: string,
    options: IngestOptions = {},
  ): MemoryEntry {
    const now = new Date().toISOString();
    const importance = options.importance ?? 0.5;
    const entry: MemoryEntry = {
      id: options.id || randomUUID(),
      type: options.type || "note",
      title,
      content,
      files: options.files || [],
      tags: options.tags || [],
      source: options.source,
      category: options.category,
      importance,
      links: options.links || [],
      ttlExpires: options.ttlExpires,
      createdAt: options.createdAt || now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO memories (id, type, title, content, files, tags, source, category, importance, ttl_expires, embedding, links, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.type,
        entry.title,
        entry.content,
        JSON.stringify(entry.files),
        JSON.stringify(entry.tags),
        entry.source || null,
        entry.category || null,
        entry.importance,
        entry.ttlExpires || null,
        options.embedding ? JSON.stringify(options.embedding) : null,
        JSON.stringify(entry.links),
        entry.createdAt,
        entry.updatedAt,
      );

    return entry;
  }

  get(id: string): MemoryEntry | null {
    const row = this.db.prepare("SELECT * FROM memories WHERE id = ?").get(id);
    if (!row) return null;
    return this.rowToEntry(row);
  }

  update(
    id: string,
    patch: Partial<IngestOptions & { title?: string; content?: string }>,
  ): MemoryEntry | null {
    const existing = this.get(id);
    if (!existing) return null;

    const next: MemoryEntry = {
      ...existing,
      title: patch.title ?? existing.title,
      content: patch.content ?? existing.content,
      type: patch.type ?? existing.type,
      files: patch.files ?? existing.files,
      tags: patch.tags ?? existing.tags,
      category:
        patch.category !== undefined ? patch.category : existing.category,
      importance: patch.importance ?? existing.importance,
      links: patch.links ?? existing.links,
      ttlExpires:
        patch.ttlExpires !== undefined ? patch.ttlExpires : existing.ttlExpires,
      source: patch.source ?? existing.source,
      updatedAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `UPDATE memories SET type=?, title=?, content=?, files=?, tags=?, source=?, category=?, importance=?, ttl_expires=?, embedding=?, links=?, updated_at=? WHERE id=?`,
      )
      .run(
        next.type,
        next.title,
        next.content,
        JSON.stringify(next.files),
        JSON.stringify(next.tags),
        next.source || null,
        next.category || null,
        next.importance,
        next.ttlExpires || null,
        next.embedding ? JSON.stringify(next.embedding) : null,
        JSON.stringify(next.links),
        next.updatedAt,
        id,
      );

    return next;
  }

  list(limit = 50, type?: MemoryType): MemoryEntry[] {
    let query = "SELECT * FROM memories";
    const params: Array<string | number> = [];

    if (type) {
      query += " WHERE type = ?";
      params.push(type);
    }

    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const rows = this.db.prepare(query).all(...params);
    return rows.map((r) => this.rowToEntry(r));
  }

  search(query: string, limit = 10): MemorySearchResult[] {
    const q = `%${query.toLowerCase()}%`;
    const rows = this.db
      .prepare(
        `SELECT * FROM memories
         WHERE lower(title) LIKE ? OR lower(content) LIKE ? OR lower(tags) LIKE ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(q, q, q, limit);

    return rows.map((row) => ({
      entry: this.rowToEntry(row),
      score: 1,
      matchedOn: "keyword" as const,
    }));
  }

  searchByFiles(files: string[], limit = 15): MemoryEntry[] {
    if (files.length === 0) return [];

    // Simple approach: fetch recent and filter in JS for now
    const all = this.list(200);
    const matched = all.filter((m) =>
      m.files.some((f) =>
        files.some(
          (pf) =>
            f.includes(pf) ||
            pf.includes(f) ||
            path.basename(f) === path.basename(pf),
        ),
      ),
    );

    return matched.slice(0, limit);
  }

  /** Memories linked to a conversation / repository / workspace */
  listByLink(kind: string, id: string, limit = 50): MemoryEntry[] {
    const all = this.list(500);
    return all
      .filter((m) => m.links.some((l) => l.kind === kind && l.id === id))
      .slice(0, limit);
  }

  delete(id: string): boolean {
    const result = this.db.prepare("DELETE FROM memories WHERE id = ?").run(id);
    return result.changes > 0;
  }

  /** Remove expired entries; returns ids removed */
  purgeExpired(now = Date.now()): string[] {
    const rows = this.db
      .prepare(
        "SELECT id FROM memories WHERE ttl_expires IS NOT NULL AND ttl_expires <= ?",
      )
      .all(new Date(now).toISOString());
    const ids = rows.map((r) => String(r.id));
    for (const id of ids) {
      this.db.prepare("DELETE FROM memories WHERE id = ?").run(id);
    }
    return ids;
  }

  /** Persist an embedding vector for a memory */
  setEmbedding(id: string, vector: number[]): boolean {
    const res = this.db
      .prepare("UPDATE memories SET embedding = ? WHERE id = ?")
      .run(JSON.stringify(vector), id);
    return res.changes > 0;
  }

  /** All persisted embeddings for semantic search */
  allEmbeddings(): { id: string; vector: number[] }[] {
    const rows = this.db
      .prepare("SELECT id, embedding FROM memories WHERE embedding IS NOT NULL")
      .all();
    const out: { id: string; vector: number[] }[] = [];
    for (const r of rows) {
      try {
        out.push({
          id: String(r.id),
          vector: JSON.parse(String(r.embedding)) as number[],
        });
      } catch {
        // skip corrupt vector
      }
    }
    return out;
  }

  stats() {
    const total = this.db
      .prepare("SELECT COUNT(*) as c FROM memories")
      .get() as { c: number };
    const byType = this.db
      .prepare("SELECT type, COUNT(*) as c FROM memories GROUP BY type")
      .all() as { type: string; c: number }[];
    const byCategory = this.db
      .prepare(
        "SELECT category, COUNT(*) as c FROM memories WHERE category IS NOT NULL GROUP BY category",
      )
      .all() as { category: string; c: number }[];
    const expired = this.db
      .prepare(
        "SELECT COUNT(*) as c FROM memories WHERE ttl_expires IS NOT NULL AND ttl_expires <= ?",
      )
      .get(new Date().toISOString()) as { c: number };

    return {
      total: total.c,
      byType: Object.fromEntries(byType.map((r) => [r.type, r.c])),
      byCategory: Object.fromEntries(byCategory.map((r) => [r.category, r.c])),
      expired,
    };
  }

  /** All tags with occurrence counts (top 100) */
  tagStats(limit = 100): { tag: string; count: number }[] {
    const rows = this.db.prepare("SELECT tags FROM memories").all() as {
      tags: string;
    }[];
    const counts = new Map<string, number>();
    for (const row of rows) {
      let tags: string[] = [];
      try {
        tags = JSON.parse(row.tags || "[]");
      } catch {
        continue;
      }
      for (const t of tags) {
        const key = String(t).toLowerCase().trim();
        if (key) counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  }

  close() {
    this.db.close();
  }

  private rowToEntry(row: Record<string, unknown>): MemoryEntry {
    const entry: MemoryEntry = {
      id: String(row.id),
      type: String(row.type) as MemoryType,
      title: String(row.title),
      content: String(row.content),
      files: this.parseJsonArray(row.files),
      tags: this.parseJsonArray(row.tags),
      source: row.source ? String(row.source) : undefined,
      category: row.category ? String(row.category) : undefined,
      importance: typeof row.importance === "number" ? row.importance : 0.5,
      links: this.parseJsonArray(row.links),
      ttlExpires: row.ttl_expires ? String(row.ttl_expires) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
    if (row.embedding) {
      try {
        entry.embedding = JSON.parse(String(row.embedding)) as number[];
      } catch {
        // ignore corrupt embedding
      }
    }
    return entry;
  }

  private parseJsonArray(value: unknown): any[] {
    try {
      const parsed = JSON.parse(String(value || "[]"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
