export type MemoryType =
  | "decision"
  | "bugfix"
  | "architecture"
  | "pattern"
  | "security"
  | "note"
  | "api"
  | "refactor";

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  files: string[];
  tags: string[];
  source?: string; // e.g. "PR #42", "commit abc123", "manual"
  createdAt: string;
  updatedAt: string;
  embedding?: number[]; // optional vector
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
  matchedOn: "keyword" | "semantic" | "file";
}

export interface MemoryStoreOptions {
  dbPath: string;
  enableVector?: boolean;
}

export interface IngestOptions {
  type?: MemoryType;
  files?: string[];
  tags?: string[];
  source?: string;
}
