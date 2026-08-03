/**
 * Learning from review feedback (thumbs up / down)
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

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
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
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
    `);
  }

  add(vote: FeedbackVote, opts: {
    reviewId: string;
    prNumber?: number;
    comment?: string;
    memoryIds?: string[];
  }): FeedbackEntry {
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
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.id,
        entry.reviewId,
        entry.prNumber ?? null,
        entry.vote,
        entry.comment ?? null,
        JSON.stringify(entry.memoryIds),
        entry.createdAt
      );

    return entry;
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
      .prepare(`SELECT memory_ids FROM feedback WHERE vote = 'down' ORDER BY created_at DESC LIMIT 100`)
      .all() as { memory_ids: string }[];

    const counts = new Map<string, number>();
    for (const row of rows) {
      const ids: string[] = JSON.parse(row.memory_ids || "[]");
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
}
