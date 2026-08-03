import Database from "better-sqlite3";
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

export class MemoryStore {
  private db: Database.Database;
  private dbPath: string;

  constructor(options: MemoryStoreOptions) {
    this.dbPath = options.dbPath;
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initSchema();
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
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
    `);
  }

  add(
    title: string,
    content: string,
    options: IngestOptions = {}
  ): MemoryEntry {
    const now = new Date().toISOString();
    const entry: MemoryEntry = {
      id: randomUUID(),
      type: options.type || "note",
      title,
      content,
      files: options.files || [],
      tags: options.tags || [],
      source: options.source,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO memories (id, type, title, content, files, tags, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.id,
        entry.type,
        entry.title,
        entry.content,
        JSON.stringify(entry.files),
        JSON.stringify(entry.tags),
        entry.source || null,
        entry.createdAt,
        entry.updatedAt
      );

    return entry;
  }

  get(id: string): MemoryEntry | null {
    const row = this.db
      .prepare("SELECT * FROM memories WHERE id = ?")
      .get(id) as any;
    if (!row) return null;
    return this.rowToEntry(row);
  }

  list(limit = 50, type?: MemoryType): MemoryEntry[] {
    let query = "SELECT * FROM memories";
    const params: any[] = [];

    if (type) {
      query += " WHERE type = ?";
      params.push(type);
    }

    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.rowToEntry(r));
  }

  search(query: string, limit = 10): MemorySearchResult[] {
    const q = `%${query.toLowerCase()}%`;
    const rows = this.db
      .prepare(
        `SELECT * FROM memories
         WHERE lower(title) LIKE ? OR lower(content) LIKE ? OR lower(tags) LIKE ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(q, q, q, limit) as any[];

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
          (pf) => f.includes(pf) || pf.includes(f) || path.basename(f) === path.basename(pf)
        )
      )
    );

    return matched.slice(0, limit);
  }

  delete(id: string): boolean {
    const result = this.db.prepare("DELETE FROM memories WHERE id = ?").run(id);
    return result.changes > 0;
  }

  stats() {
    const total = this.db.prepare("SELECT COUNT(*) as c FROM memories").get() as any;
    const byType = this.db
      .prepare("SELECT type, COUNT(*) as c FROM memories GROUP BY type")
      .all() as any[];

    return {
      total: total.c,
      byType: Object.fromEntries(byType.map((r) => [r.type, r.c])),
    };
  }

  close() {
    this.db.close();
  }

  private rowToEntry(row: any): MemoryEntry {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      content: row.content,
      files: JSON.parse(row.files || "[]"),
      tags: JSON.parse(row.tags || "[]"),
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
