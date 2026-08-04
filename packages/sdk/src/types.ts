export type MemoryType =
  | "note"
  | "decision"
  | "bugfix"
  | "architecture"
  | "security"
  | "pattern"
  | "api"
  | "refactor"
  | string;

export interface Memory {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  tags: string[];
  files?: string[];
  source?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SearchHit {
  id: string;
  title: string;
  type: string;
  score?: number;
  rankScore: number;
  content: string;
  tags?: string[];
}

export interface Stats {
  total: number;
  byType: Record<string, number>;
}

export interface ChatResult {
  answer: string;
  sources: { id: string; title: string; type: string; rankScore?: number }[];
  source: "llm" | "rules" | string;
}

export interface CommitMessageResult {
  message: string;
  source: "llm" | "rules" | string;
}

export interface ReleaseNotesResult {
  notes: string;
  source: "llm" | "rules" | string;
}

export interface AnalyzeReport {
  filesScanned: number;
  summary: { avgScore: number; maxScore: number; deadHints: number };
  hotspots: { file: string; score: number; lines: number; cyclomaticApprox: number }[];
  deadCode: { file: string; kind: string; line: number; symbol: string; detail?: string }[];
}

export interface GraphNode {
  id: string;
  label: string;
  kind: string;
  memoryType?: string;
  size: number;
  x: number;
  y: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: string;
  weight: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: { memories: number; types: number; tags: number; edges: number };
}

export interface ReviewResult {
  title: string;
  summary?: string;
  relatedMemories?: { id: string; title: string; rankScore?: number }[];
}

export interface HealthStatus {
  ok: boolean;
  service?: string;
  version?: string;
}

export class HexVaultApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "HexVaultApiError";
  }
}
