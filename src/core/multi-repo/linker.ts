/**
 * Multi-repo memory linking
 * Allows sharing / searching memories across related repositories
 */
import path from "path";
import fs from "fs";
import { MemoryStore } from "../memory/store.js";
import type { MemoryEntry, MemorySearchResult } from "../memory/types.js";

export interface LinkedRepo {
  name: string;
  path: string; // local path or identifier
  memoryDb: string;
}

export class MultiRepoLinker {
  private repos: LinkedRepo[] = [];
  private stores = new Map<string, MemoryStore>();

  addRepo(repo: LinkedRepo) {
    this.repos.push(repo);
    if (fs.existsSync(repo.memoryDb)) {
      this.stores.set(repo.name, new MemoryStore({ dbPath: repo.memoryDb }));
    }
  }

  loadFromConfig(configPath: string) {
    if (!fs.existsSync(configPath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const list: LinkedRepo[] = raw.repos || [];
      for (const r of list) this.addRepo(r);
    } catch {
      // ignore
    }
  }

  searchAll(
    query: string,
    limit = 15,
  ): (MemorySearchResult & { repo: string })[] {
    const results: (MemorySearchResult & { repo: string })[] = [];

    for (const [name, store] of this.stores) {
      const hits = store.search(query, limit);
      for (const h of hits) {
        results.push({ ...h, repo: name });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  listAll(limit = 30): (MemoryEntry & { repo: string })[] {
    const all: (MemoryEntry & { repo: string })[] = [];
    for (const [name, store] of this.stores) {
      for (const e of store.list(limit)) {
        all.push({ ...e, repo: name });
      }
    }
    return all.slice(0, limit);
  }

  close() {
    for (const store of this.stores.values()) store.close();
    this.stores.clear();
  }
}

/** Helper to create a multi-repo config file */
export function createMultiRepoConfig(filePath: string, repos: LinkedRepo[]) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ repos }, null, 2));
}
