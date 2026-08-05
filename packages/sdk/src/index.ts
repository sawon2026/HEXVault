/**
 * @hexvault/sdk — official TypeScript client for HEXVault REST API
 *
 * @example
 * ```ts
 * import { HexVaultClient } from "@hexvault/sdk";
 *
 * const client = new HexVaultClient({ baseUrl: "http://127.0.0.1:3850" });
 * await client.addMemory({ content: "Use SQLite", type: "decision" });
 * const hits = await client.search("database");
 * const answer = await client.chat("What DB do we use?");
 * ```
 */

export { HexVaultClient, createClient } from "./client.js";
export type { HexVaultClientOptions } from "./client.js";
export { HexVaultApiError } from "./types.js";
export type {
  Memory,
  MemoryType,
  SearchHit,
  Stats,
  ChatResult,
  CommitMessageResult,
  ReleaseNotesResult,
  AnalyzeReport,
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  ReviewResult,
  HealthStatus,
} from "./types.js";
