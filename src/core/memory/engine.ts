/**
 * Production Memory Engine — extends MemoryStore with:
 * ranking, importance, expiration, hybrid search, deduplication.
 */
import { MemoryStore } from "./store.js";
import type { MemoryEntry, MemorySearchResult, MemoryType, IngestOptions } from "./types.js";
import { simpleEmbed, cosineSimilarity } from "../vector/embeddings.js";
import { log } from "../logging/logger.js";

export interface RankedMemory extends MemorySearchResult {
  importance: number;
  rankScore: number;
}

export interface EngineOptions {
  dbPath: string;
  defaultTtlDays?: number;
  dedupThreshold?: number;
}

function importanceFromType(type: MemoryType): number {
  const map: Record<string, number> = {
    security: 1.0,
    decision: 0.9,
    architecture: 0.9,
    bugfix: 0.85,
    pattern: 0.7,
    api: 0.7,
    refactor: 0.55,
    note: 0.4,
  };
  return map[type] ?? 0.5;
}

function recencyBoost(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.max(0.3, 1 - ageDays / 500);
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

  add(
    title: string,
    content: string,
    options: IngestOptions & { ttlDays?: number } = {}
  ): MemoryEntry {
    const dup = this.findDuplicate(title, content);
    if (dup) {
      this.logger.info("Dedup hit — reusing existing memory", { id: dup.id });
      return dup;
    }
    const entry = this.store.add(title, content, options);
    this.logger.debug("Memory added", { id: entry.id, type: entry.type });
    return entry;
  }

  get(id: string) {
    return this.store.get(id);
  }

  list(limit = 50, type?: MemoryType) {
    return this.purgeExpired(this.store.list(limit * 2, type)).slice(0, limit);
  }

  stats() {
    return this.store.stats();
  }

  hybridSearch(query: string, limit = 10): RankedMemory[] {
    const keyword = this.store.search(query, limit * 3);
    const all = this.purgeExpired(this.store.list(200));
    const qVec = simpleEmbed(query);
    const byId = new Map<string, RankedMemory>();

    for (const hit of keyword) {
      const importance = importanceFromType(hit.entry.type);
      const rankScore =
        hit.score * 0.45 + importance * 0.35 + recencyBoost(hit.entry.createdAt) * 0.2;
      byId.set(hit.entry.id, { ...hit, importance, rankScore });
    }

    for (const entry of all) {
      if (byId.has(entry.id)) continue;
      const text = `${entry.title} ${entry.content} ${entry.tags.join(" ")}`;
      const sim = cosineSimilarity(qVec, simpleEmbed(text));
      if (sim < 0.08) continue;
      const importance = importanceFromType(entry.type);
      byId.set(entry.id, {
        entry,
        score: sim,
        matchedOn: "semantic",
        importance,
        rankScore: sim * 0.45 + importance * 0.35 + recencyBoost(entry.createdAt) * 0.2,
      });
    }

    return [...byId.values()]
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, limit);
  }

  findDuplicate(title: string, content: string): MemoryEntry | null {
    const candidates = this.store.list(100);
    const target = simpleEmbed(`${title} ${content}`);
    for (const c of candidates) {
      const sim = cosineSimilarity(target, simpleEmbed(`${c.title} ${c.content}`));
      if (sim >= this.dedupThreshold) return c;
    }
    return null;
  }

  private purgeExpired(entries: MemoryEntry[]): MemoryEntry[] {
    if (this.defaultTtlDays <= 0) return entries;
    const maxAge = this.defaultTtlDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return entries.filter((e) => now - new Date(e.createdAt).getTime() <= maxAge);
  }

  timeline(limit = 50): MemoryEntry[] {
    return this.list(limit);
  }

  analytics() {
    const stats = this.store.stats();
    const recent = this.list(20);
    const byImportance = recent.map((e) => ({
      id: e.id,
      title: e.title,
      importance: importanceFromType(e.type),
    }));
    return {
      ...stats,
      topRecent: byImportance.sort((a, b) => b.importance - a.importance).slice(0, 5),
    };
  }

  close() {
    this.store.close();
  }
}
