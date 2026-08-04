/**
 * @hexvault/sdk — official TypeScript client for HEXVault REST API
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
