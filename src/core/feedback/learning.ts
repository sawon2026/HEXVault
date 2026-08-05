/**
 * Learning from review feedback (thumbs up / down).
 *
 * Stores votes with the memory ids used in the reviewed PR so future
 * reviews can down-rank memories that repeatedly appear in downvoted
 * reviews. Uses the platform SQLite adapter (zero native deps).
 */
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { openDatabaseSync, type SqliteDatabase } from "../db/sqlite.js";

export type FeedbackVote = "up" | "down";

export interface FeedbackEntry {
  id: string;
  reviewId: string;
  prNumber?: number;
  vote: FeedbackVote;
  comment?: string;
  memoryIds: string[];
  createdAt: string;
}

export class FeedbackStore {
  private db: SqliteDatabase;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = openDatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL,
        pr_number INTEGER,
        vote TEXT NOT NULL,
        comment TEXT,
        memory_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_feedback_vote ON feedback(vote);
      CREATE INDEX IF NOT EXISTS idx_feedback_review ON feedback(review_id);
    `);
  }

  add(
    vote: FeedbackVote,
    opts: {
      reviewId: string;
      prNumber?: number;
      comment?: string;
      memoryIds?: string[];
    },
  ): FeedbackEntry {
    const entry: FeedbackEntry = {
      id: randomUUID(),
      reviewId: opts.reviewId,
      prNumber: opts.prNumber,
      vote,
      comment: opts.comment,
      memoryIds: opts.memoryIds || [],
      createdAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `INSERT INTO feedback (id, review_id, pr_number, vote, comment, memory_ids, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.reviewId,
        entry.prNumber ?? null,
        entry.vote,
        entry.comment ?? null,
        JSON.stringify(entry.memoryIds),
        entry.createdAt,
      );

    return entry;
  }

  /** Recent feedback rows for a review (used to avoid duplicate votes) */
  findByReview(reviewId: string, limit = 50): FeedbackEntry[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM feedback WHERE review_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(reviewId, limit);
    return rows.map((r) => this.rowToEntry(r));
  }

  stats() {
    const rows = this.db
      .prepare(`SELECT vote, COUNT(*) as c FROM feedback GROUP BY vote`)
      .all() as { vote: string; c: number }[];

    const result = { up: 0, down: 0, total: 0 };
    for (const r of rows) {
      if (r.vote === "up") result.up = r.c;
      if (r.vote === "down") result.down = r.c;
      result.total += r.c;
    }
    return result;
  }

  /** Memories that frequently appear in downvoted reviews */
  getProblematicMemoryIds(limit = 20): string[] {
    const rows = this.db
      .prepare(
        `SELECT memory_ids FROM feedback WHERE vote = 'down' ORDER BY created_at DESC LIMIT 100`,
      )
      .all() as { memory_ids: string }[];

    const counts = new Map<string, number>();
    for (const row of rows) {
      const ids: string[] = this.parseIds(row.memory_ids);
      for (const id of ids) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);
  }

  close() {
    this.db.close();
  }

  private parseIds(raw: string): string[] {
    try {
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  private rowToEntry(row: Record<string, unknown>): FeedbackEntry {
    return {
      id: String(row.id),
      reviewId: String(row.review_id),
      prNumber:
        row.pr_number !== null && row.pr_number !== undefined
          ? Number(row.pr_number)
          : undefined,
      vote: String(row.vote) as FeedbackVote,
      comment: row.comment ? String(row.comment) : undefined,
      memoryIds: this.parseIds(row.memory_ids ? String(row.memory_ids) : ""),
      createdAt: String(row.created_at),
    };
  }
}
