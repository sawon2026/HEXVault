export type MemoryType =
  | "decision"
  | "bugfix"
  | "architecture"
  | "pattern"
  | "security"
  | "note"
  | "api"
  | "refactor"
  | "conversation";

export interface MemoryLink {
  kind: "repository" | "workspace" | "conversation" | "commit" | "issue" | "pr";
  id: string;
  label?: string;
}

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  files: string[];
  tags: string[];
  source?: string; // e.g. "PR #42", "commit abc123", "manual"
  category?: string; // free-form grouping, e.g. "auth", "build"
  importance: number; // 0..1, higher = more important
  links: MemoryLink[]; // repository / workspace / conversation links
  ttlExpires?: string; // ISO timestamp; undefined = never expires
  createdAt: string;
  updatedAt: string;
  embedding?: number[]; // optional persisted vector
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
  category?: string;
  importance?: number;
  links?: MemoryLink[];
  ttlExpires?: string;
  embedding?: number[];
  id?: string;
  createdAt?: string;
}
