/**
 * Production Memory Engine — extends MemoryStore with:
 *  - importance scoring (persisted, explainable)
 *  - per-entry TTL expiration (auto-purge)
 *  - automatic tag suggestion
 *  - categories + links (repository / workspace / conversation)
 *  - conversation tracking (chat sessions -> memories)
 *  - hybrid search (keyword + persisted semantic vectors)
 *  - deduplication (with embedding cache)
 *  - timeline, analytics, health, summarization
 */
import { MemoryStore } from "./store.js";
import type {
  MemoryEntry,
  MemorySearchResult,
  MemoryType,
  IngestOptions,
  MemoryLink,
} from "./types.js";
import { simpleEmbed, cosineSimilarity } from "../vector/embeddings.js";
import { log } from "../logging/logger.js";

export interface RankedMemory extends MemorySearchResult {
  importance: number;
  rankScore: number;
  reasons: string[];
}

export interface EngineOptions {
  dbPath: string;
  /** Default TTL days; 0 = never expire */
  defaultTtlDays?: number;
  /** Dedup similarity threshold 0..1 */
  dedupThreshold?: number;
}

export interface MemoryHealthReport {
  ok: boolean;
  total: number;
  expiredCount: number;
  staleCount: number;
  importanceAvg: number;
  importanceHigh: number;
  categoryCount: number;
  tagsCount: number;
  linksCount: number;
  orphanedCount: number;
  recentActivity: number;
  warnings: string[];
  recommendations: string[];
}

export interface TimelineItem {
  date: string; // YYYY-MM-DD
  count: number;
  types: Record<string, number>;
}

/** Base importance by memory type — used when no explicit score given */
export function importanceFromType(type: MemoryType): number {
  const map: Record<string, number> = {
    security: 1.0,
    decision: 0.9,
    architecture: 0.9,
    bugfix: 0.85,
    pattern: 0.7,
    api: 0.7,
    refactor: 0.55,
    conversation: 0.35,
    note: 0.4,
  };
  return map[type] ?? 0.5;
}

function recencyBoost(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  // 1.0 today → ~0.3 after 365 days
  return Math.max(0.3, 1 - ageDays / 500);
}

/** Suggest tags from free text — simple keyword extraction (no external NLP). */
export function suggestTags(
  text: string,
  opts?: { max?: number; minLength?: number; stopwords?: string[] },
): string[] {
  const max = opts?.max ?? 5;
  const minLength = opts?.minLength ?? 4;
  const stop = new Set(
    (
      opts?.stopwords || [
        "the",
        "and",
        "for",
        "with",
        "this",
        "that",
        "from",
        "have",
        "will",
        "using",
        "about",
        "into",
        "should",
        "never",
        "always",
        "must",
        "project",
      ]
    ).map((s) => s.toLowerCase()),
  );

  const counts = new Map<string, number>();
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/);
  for (const raw of tokens) {
    const t = raw.replace(/^[-_]+|[-_]+$/g, "");
    if (t.length < minLength || t.length > 32) continue;
    if (stop.has(t)) continue;
    if (/^(https?:\/\/|\d{4}-\d{2}-\d{2})/.test(t)) continue;
    counts.set(t, (counts.get(t) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([tag]) => tag);
}

export class MemoryEngine {
  private store: MemoryStore;
  private dedupThreshold: number;
  private defaultTtlDays: number;
  private logger = log.child("memory-engine");

  constructor(opts: EngineOptions) {
    this.store = new MemoryStore({ dbPath: opts.dbPath, enableVector: true });
    this.dedupThreshold = opts.dedupThreshold ?? 0.92;
    this.defaultTtlDays = opts.defaultTtlDays ?? 0;
  }

  /* ── Write path ────────────────────────────────────────── */

  /** Add with optional dedup + auto-tagging — returns existing id if near-duplicate */
  add(
    title: string,
    content: string,
    options: IngestOptions & { ttlDays?: number; autoTag?: boolean } = {},
  ): MemoryEntry {
    const dup = this.findDuplicate(title, content);
    if (dup) {
      this.logger.info("Dedup hit — reusing existing memory", { id: dup.id });
      return dup;
    }

    const importance =
      options.importance ?? importanceFromType(options.type || "note");
    const ttlExpires =
      options.ttlExpires ??
      (options.ttlDays || this.defaultTtlDays > 0
        ? new Date(
            Date.now() + (options.ttlDays || this.defaultTtlDays) * 86400_000,
          ).toISOString()
        : undefined);

    const tags =
      options.autoTag === false
        ? options.tags
        : [
            ...(options.tags || []),
            ...suggestTags(`${title} ${content}`),
          ].filter((t, i, arr) => arr.indexOf(t) === i);

    const entry = this.store.add(title, content, {
      ...options,
      importance,
      ttlExpires,
      tags,
    });
    this.embedAsync(
      entry.id,
      `${entry.title} ${entry.content} ${entry.tags.join(" ")}`,
    );
    this.logger.debug("Memory added", {
      id: entry.id,
      type: entry.type,
      importance,
    });
    return entry;
  }

  get(id: string) {
    return this.store.get(id);
  }

  update(id: string, patch: Parameters<MemoryStore["update"]>[1]) {
    const updated = this.store.update(id, patch);
    if (updated) {
      this.embedAsync(
        updated.id,
        `${updated.title} ${updated.content} ${updated.tags.join(" ")}`,
      );
    }
    return updated;
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  list(limit = 50, type?: MemoryType) {
    this.purgeExpired();
    return this.store.list(limit, type);
  }

  stats() {
    this.purgeExpired();
    return this.store.stats();
  }

  tagStats(limit = 100) {
    return this.store.tagStats(limit);
  }

  close() {
    this.store.close();
  }

  /* ── Expiration ────────────────────────────────────────── */

  /** Purge expired entries (per-entry TTLs and global default); returns ids removed. */
  purgeExpired(now?: number): string[] {
    const removed = this.store.purgeExpired(now);
    if (removed.length) {
      this.logger.info("Purged expired memories", { count: removed.length });
    }
    return removed;
  }

  /** Set a per-entry TTL (days) from now */
  setTtl(id: string, days: number): MemoryEntry | null {
    const expires = new Date(Date.now() + days * 86400_000).toISOString();
    return this.store.update(id, { ttlExpires: expires });
  }

  /* ── Linking ───────────────────────────────────────────── */

  /** Link an existing memory to a repository / workspace / conversation */
  linkMemory(id: string, link: MemoryLink): MemoryEntry | null {
    const entry = this.get(id);
    if (!entry) return null;
    const links = [
      ...entry.links.filter((l) => !(l.kind === link.kind && l.id === link.id)),
      link,
    ];
    return this.store.update(id, { links });
  }

  listByLink(kind: MemoryLink["kind"], id: string, limit = 50) {
    return this.store.listByLink(kind, id, limit);
  }

  /** Record a conversation: attaches chat Q&A as a memory linked to the conversation. */
  recordConversation(opts: {
    conversationId: string;
    question: string;
    answer: string;
    sourceMemories?: string[];
    title?: string;
  }): MemoryEntry | null {
    if (!opts.question.trim() || !opts.answer.trim()) return null;
    const links: MemoryLink[] = [
      {
        kind: "conversation",
        id: opts.conversationId,
        label: `conversation ${opts.conversationId.slice(0, 8)}`,
      },
    ];
    return this.add(
      opts.title || opts.question.slice(0, 80),
      `Q: ${opts.question}\nA: ${opts.answer}`,
      {
        type: "conversation",
        source: `conversation ${opts.conversationId.slice(0, 8)}`,
        tags: ["conversation"],
        links,
        importance: 0.35,
        autoTag: false,
      },
    );
  }

  /* ── Search ────────────────────────────────────────────── */

  /**
   * Hybrid search: keyword results + semantic re-rank.
   * Uses persisted embeddings when available, else computes on the fly.
   */
  hybridSearch(query: string, limit = 10): RankedMemory[] {
    this.purgeExpired();
    const keyword = this.store.search(query, limit * 3);
    const all = this.store.list(200);

    const qVec = simpleEmbed(query);
    const cached = new Map(
      this.store.allEmbeddings().map((e) => [e.id, e.vector]),
    );
    const byId = new Map<string, RankedMemory>();

    const scoreKeyword = (hit: MemorySearchResult) => {
      const importance =
        hit.entry.importance ?? importanceFromType(hit.entry.type);
      const reasons = [
        `keyword:${hit.score.toFixed(2)}`,
        `importance:${importance.toFixed(2)}`,
      ];
      const rankScore =
        hit.score * 0.45 +
        importance * 0.35 +
        recencyBoost(hit.entry.createdAt) * 0.2;
      byId.set(hit.entry.id, { ...hit, importance, rankScore, reasons });
    };

    for (const hit of keyword) scoreKeyword(hit);

    for (const entry of all) {
      if (byId.has(entry.id)) continue;
      const vec =
        cached.get(entry.id) ??
        simpleEmbed(`${entry.title} ${entry.content} ${entry.tags.join(" ")}`);
      const sim = cosineSimilarity(qVec, vec);
      if (sim < 0.08) continue;
      const importance = entry.importance ?? importanceFromType(entry.type);
      byId.set(entry.id, {
        entry,
        score: sim,
        matchedOn: "semantic",
        importance,
        reasons: [
          `semantic:${sim.toFixed(2)}`,
          `importance:${importance.toFixed(2)}`,
        ],
        rankScore:
          sim * 0.45 + importance * 0.35 + recencyBoost(entry.createdAt) * 0.2,
      });
    }

    return [...byId.values()]
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, limit);
  }

  /** Simple near-duplicate detection via embedding cosine */
  findDuplicate(title: string, content: string): MemoryEntry | null {
    const candidates = this.store.list(100);
    const target = simpleEmbed(`${title} ${content}`);
    const cached = new Map(
      this.store.allEmbeddings().map((e) => [e.id, e.vector]),
    );
    for (const c of candidates) {
      const vec = cached.get(c.id) ?? simpleEmbed(`${c.title} ${c.content}`);
      const sim = cosineSimilarity(target, vec);
      if (sim >= this.dedupThreshold) return c;
    }
    return null;
  }

  /* ── Timeline / analytics / health ─────────────────────── */

  /** Timeline: memories grouped by day */
  timeline(limit = 200): TimelineItem[] {
    const entries = this.list(limit);
    const byDay = new Map<string, TimelineItem>();
    for (const e of entries) {
      const date = e.createdAt.slice(0, 10);
      let item = byDay.get(date);
      if (!item) {
        item = { date, count: 0, types: {} };
        byDay.set(date, item);
      }
      item.count++;
      item.types[e.type] = (item.types[e.type] || 0) + 1;
    }
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Memory analytics snapshot for dashboards */
  analytics() {
    this.purgeExpired();
    const stats = this.store.stats();
    const recent = this.list(30);
    const tagCloud = this.tagStats(20);
    const timeline = this.timeline(200);
    const byImportance = recent.map((e) => ({
      id: e.id,
      title: e.title,
      importance: e.importance ?? importanceFromType(e.type),
    }));

    return {
      ...stats,
      timeline: timeline.slice(-14),
      tagCloud,
      topRecent: byImportance
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 5),
      growth30d: timeline.slice(-30).reduce((s, t) => s + t.count, 0),
    };
  }

  /** Memory health report — stale, expired, orphaned, imbalance. */
  health(): MemoryHealthReport {
    this.purgeExpired();
    const entries = this.store.list(10_000);
    const now = Date.now();
    const DAY = 86400_000;

    const stale = entries.filter(
      (e) => now - new Date(e.createdAt).getTime() > 180 * DAY,
    );
    const expired = this.store.stats().expired?.c ?? 0;
    const avgImportance =
      entries.length === 0
        ? 0
        : entries.reduce((s, e) => s + (e.importance ?? 0.5), 0) /
          entries.length;
    const highImportance = entries.filter(
      (e) => (e.importance ?? 0) >= 0.85,
    ).length;
    const categories = new Set(entries.map((e) => e.category).filter(Boolean));
    const tags = new Set(entries.flatMap((e) => e.tags));
    const links = entries.filter((e) => e.links.length > 0).length;
    const orphaned = entries.filter(
      (e) =>
        e.type !== "conversation" &&
        e.links.length === 0 &&
        e.files.length === 0,
    ).length;
    const recentActivity = entries.filter(
      (e) => now - new Date(e.createdAt).getTime() < 14 * DAY,
    ).length;

    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (stale.length > Math.max(5, entries.length * 0.4)) {
      warnings.push(`${stale.length} memories are stale (> 180 days old)`);
      recommendations.push(
        "Review stale memories with `hexvault list --older-than 180` and archive what is obsolete",
      );
    }
    if (expired > 0) {
      warnings.push(`${expired} memories are expired and scheduled for purge`);
      recommendations.push(
        "Expired entries are removed automatically on the next engine operation",
      );
    }
    if (orphaned > Math.max(5, entries.length * 0.5)) {
      warnings.push(
        `${orphaned} memories are orphaned (no file / link associations)`,
      );
      recommendations.push(
        "Link memories to files or repositories with `hexvault link` or the API",
      );
    }
    if (avgImportance < 0.45) {
      recommendations.push(
        "Importance is low on average — tag important decisions with `--type decision|security`",
      );
    }
    if (categories.size === 0 && entries.length > 20) {
      recommendations.push(
        "Consider adding categories to group memories (`--category auth`)",
      );
    }
    if (tags.size === 0 && entries.length > 5) {
      recommendations.push(
        "Add tags to improve semantic recall — or enable autoTag on add",
      );
    }

    return {
      ok: warnings.length === 0,
      total: entries.length,
      expiredCount: expired,
      staleCount: stale.length,
      importanceAvg: Number(avgImportance.toFixed(2)),
      importanceHigh: highImportance,
      categoryCount: categories.size,
      tagsCount: tags.size,
      linksCount: links,
      orphanedCount: orphaned,
      recentActivity,
      warnings,
      recommendations,
    };
  }

  /* ── Embedding cache write ─────────────────────────────── */

  private embedAsync(id: string, text: string) {
    try {
      this.store.setEmbedding(id, simpleEmbed(text));
    } catch (err) {
      this.logger.warn("Embedding persist failed", {
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
