/**
 * Knowledge graph builder from project memories.
 */
import type { MemoryEntry } from "../memory/types.js";

export type GraphNodeKind = "memory" | "type" | "tag";

export interface GraphNode {
  id: string;
  label: string;
  kind: GraphNodeKind;
  memoryType?: string;
  size: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: "has-type" | "has-tag" | "related";
  weight: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: { memories: number; types: number; tags: number; edges: number };
}

export function buildKnowledgeGraph(
  memories: MemoryEntry[],
  opts?: { maxMemories?: number; includeRelated?: boolean }
): KnowledgeGraph {
  const max = opts?.maxMemories ?? 80;
  const list = memories.slice(0, max);
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const edgeKey = new Set<string>();

  function addNode(n: GraphNode) {
    const existing = nodes.get(n.id);
    if (existing) {
      existing.size = Math.min(24, existing.size + 1);
      return;
    }
    nodes.set(n.id, n);
  }

  function addEdge(e: GraphEdge) {
    const k = `${e.source}|${e.target}|${e.kind}`;
    if (edgeKey.has(k)) return;
    edgeKey.add(k);
    edges.push(e);
  }

  for (const m of list) {
    const mid = `mem:${m.id}`;
    addNode({
      id: mid,
      label: m.title.slice(0, 40) || m.id.slice(0, 8),
      kind: "memory",
      memoryType: m.type,
      size: 10,
    });
    const tid = `type:${m.type}`;
    addNode({ id: tid, label: m.type, kind: "type", size: 14 });
    addEdge({ source: mid, target: tid, kind: "has-type", weight: 1 });
    for (const tag of m.tags || []) {
      const t = tag.trim();
      if (!t) continue;
      const tagId = `tag:${t.toLowerCase()}`;
      addNode({ id: tagId, label: t, kind: "tag", size: 8 });
      addEdge({ source: mid, target: tagId, kind: "has-tag", weight: 1 });
    }
  }

  if (opts?.includeRelated !== false) {
    const byTag = new Map<string, string[]>();
    for (const m of list) {
      for (const tag of m.tags || []) {
        const key = tag.toLowerCase();
        if (!byTag.has(key)) byTag.set(key, []);
        byTag.get(key)!.push(`mem:${m.id}`);
      }
    }
    let related = 0;
    for (const ids of byTag.values()) {
      if (ids.length < 2 || related > 40) continue;
      for (let i = 0; i < ids.length && related < 40; i++) {
        for (let j = i + 1; j < Math.min(ids.length, i + 3); j++) {
          addEdge({ source: ids[i], target: ids[j], kind: "related", weight: 0.4 });
          related++;
        }
      }
    }
  }

  const nodeList = [...nodes.values()];
  return {
    nodes: nodeList,
    edges,
    stats: {
      memories: nodeList.filter((n) => n.kind === "memory").length,
      types: nodeList.filter((n) => n.kind === "type").length,
      tags: nodeList.filter((n) => n.kind === "tag").length,
      edges: edges.length,
    },
  };
}

export function layoutGraph(
  graph: KnowledgeGraph,
  width = 900,
  height = 600
): { nodes: (GraphNode & { x: number; y: number })[]; edges: GraphEdge[] } {
  const nodes = graph.nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(graph.nodes.length, 1);
    const ring = n.kind === "type" ? 0.25 : n.kind === "tag" ? 0.55 : 0.85;
    return {
      ...n,
      x: width / 2 + Math.cos(angle) * (Math.min(width, height) * 0.35 * ring),
      y: height / 2 + Math.sin(angle) * (Math.min(width, height) * 0.35 * ring),
      vx: 0,
      vy: 0,
    };
  });
  const index = new Map(nodes.map((n) => [n.id, n]));

  for (let iter = 0; iter < 80; iter++) {
    const alpha = 1 - iter / 80;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (800 * alpha) / (dist * dist);
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        a.vx += dx;
        a.vy += dy;
        b.vx -= dx;
        b.vy -= dy;
      }
    }
    for (const e of graph.edges) {
      const a = index.get(e.source);
      const b = index.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 120) * 0.02 * alpha * (e.weight || 1);
      a.vx += (dx / dist) * force;
      a.vy += (dy / dist) * force;
      b.vx -= (dx / dist) * force;
      b.vy -= (dy / dist) * force;
    }
    for (const n of nodes) {
      n.vx += (width / 2 - n.x) * 0.01 * alpha;
      n.vy += (height / 2 - n.y) * 0.01 * alpha;
      n.x += n.vx * 0.6;
      n.y += n.vy * 0.6;
      n.vx *= 0.6;
      n.vy *= 0.6;
      n.x = Math.max(30, Math.min(width - 30, n.x));
      n.y = Math.max(30, Math.min(height - 30, n.y));
    }
  }

  return {
    nodes: nodes.map(({ vx: _a, vy: _b, ...rest }) => rest),
    edges: graph.edges,
  };
}
