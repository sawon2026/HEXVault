/**
 * Memory exchange — foundation for team / multi-instance sync.
 */
import type { MemoryEngine } from "../memory/engine.js";
import type { MemoryType } from "../memory/types.js";

export const SYNC_FORMAT = "hexvault-sync-v1" as const;

export interface SyncBundle {
  format: typeof SYNC_FORMAT;
  exportedAt: string;
  source?: string;
  memories: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    tags: string[];
    files?: string[];
    source?: string;
    createdAt: string;
    updatedAt?: string;
  }>;
}

export interface ImportResult {
  added: number;
  skipped: number;
  totalInBundle: number;
}

export function exportBundle(
  engine: MemoryEngine,
  opts?: { limit?: number; source?: string }
): SyncBundle {
  const limit = opts?.limit ?? 10_000;
  const list = engine.list(limit);
  return {
    format: SYNC_FORMAT,
    exportedAt: new Date().toISOString(),
    source: opts?.source,
    memories: list.map((m) => ({
      id: m.id,
      type: m.type,
      title: m.title,
      content: m.content,
      tags: m.tags || [],
      files: m.files,
      source: m.source,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    })),
  };
}

export function parseBundle(raw: unknown): SyncBundle {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid sync bundle: not an object");
  }
  const b = raw as Record<string, unknown>;
  if (b.format !== SYNC_FORMAT) {
    throw new Error(`Unsupported sync format: ${String(b.format)}`);
  }
  if (!Array.isArray(b.memories)) {
    throw new Error("Invalid sync bundle: memories must be an array");
  }
  return b as unknown as SyncBundle;
}

export function importBundle(
  engine: MemoryEngine,
  bundle: SyncBundle,
  opts?: { skipExistingIds?: boolean }
): ImportResult {
  const skipIds = opts?.skipExistingIds !== false;
  let added = 0;
  let skipped = 0;

  for (const m of bundle.memories) {
    if (skipIds && m.id && engine.get(m.id)) {
      skipped++;
      continue;
    }
    const before = engine.stats().total;
    engine.add(m.title || m.content.slice(0, 60), m.content, {
      type: (m.type || "note") as MemoryType,
      tags: m.tags || [],
      files: m.files || [],
      source: m.source || "sync-import",
    });
    const after = engine.stats().total;
    if (after > before) added++;
    else skipped++;
  }

  return { added, skipped, totalInBundle: bundle.memories.length };
}

export async function pullFromRemote(
  engine: MemoryEngine,
  remoteBaseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<ImportResult> {
  const base = remoteBaseUrl.replace(/\/$/, "");
  const res = await fetchImpl(`${base}/v1/sync/export`);
  if (!res.ok) throw new Error(`Remote export failed: ${res.status}`);
  const json = await res.json();
  return importBundle(engine, parseBundle(json));
}
