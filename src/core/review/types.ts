export interface ReviewComment {
  path?: string;
  line?: number;
  body: string;
  severity: "info" | "warning" | "error" | "suggestion";
}

export interface ReviewResult {
  summary: string;
  comments: ReviewComment[];
  securityIssues: string[];
  consistencyNotes: string[];
  score: number; // 0-100
  usedMemories: string[]; // memory titles used
}

export interface ReviewOptions {
  model?: string;
  severity?: "low" | "medium" | "high";
  checks?: string[];
  maxMemories?: number;
}
