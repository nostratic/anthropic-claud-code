// Pure, immutable operations on MindMapData. Every function returns a new
// object so the editor can keep a simple undo/redo stack of snapshots.

import type { MindMapData, MindNode, Side } from "./types";

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export function createMap(rootText = "Central Idea"): MindMapData {
  const rootId = uid();
  return {
    rootId,
    nodes: {
      [rootId]: { id: rootId, text: rootText, children: [], parentId: null },
    },
  };
}

function clone(data: MindMapData): MindMapData {
  return { rootId: data.rootId, nodes: { ...data.nodes } };
}

function patchNode(
  data: MindMapData,
  id: string,
  patch: Partial<MindNode>
): MindMapData {
  const next = clone(data);
  next.nodes[id] = { ...next.nodes[id], ...patch };
  return next;
}

export function depthOf(data: MindMapData, id: string): number {
  let d = 0;
  let cur = data.nodes[id];
  while (cur && cur.parentId) {
    d++;
    cur = data.nodes[cur.parentId];
  }
  return d;
}

export function isAncestor(
  data: MindMapData,
  ancestorId: string,
  id: string
): boolean {
  let cur = data.nodes[id];
  while (cur && cur.parentId) {
    if (cur.parentId === ancestorId) return true;
    cur = data.nodes[cur.parentId];
  }
  return false;
}

/** The first-level ancestor of a node (or null for the root). */
export function branchRoot(data: MindMapData, id: string): string | null {
  let cur = data.nodes[id];
  if (!cur || !cur.parentId) return null;
  while (cur.parentId && cur.parentId !== data.rootId) {
    cur = data.nodes[cur.parentId];
  }
  return cur.id;
}

/** Choose the side with fewer first-level children (balanced map). */
function balancedSide(data: MindMapData): Side {
  const root = data.nodes[data.rootId];
  let left = 0;
  let right = 0;
  for (const c of root.children) {
    if (data.nodes[c]?.side === "left") left++;
    else right++;
  }
  return right <= left ? "right" : "left";
}

export function addChild(
  data: MindMapData,
  parentId: string,
  text = "",
  index?: number,
  side?: Side
): { data: MindMapData; id: string } {
  const id = uid();
  const next = clone(data);
  const parent = { ...next.nodes[parentId] };
  const node: MindNode = { id, text, children: [], parentId };
  if (parentId === data.rootId) node.side = side ?? balancedSide(data);
  const children = [...parent.children];
  if (index === undefined || index < 0 || index > children.length) {
    children.push(id);
  } else {
    children.splice(index, 0, id);
  }
  parent.children = children;
  parent.collapsed = false;
  next.nodes[parentId] = parent;
  next.nodes[id] = node;
  return { data: next, id };
}

export function addSibling(
  data: MindMapData,
  id: string,
  text = "",
  before = false
): { data: MindMapData; id: string } {
  const node = data.nodes[id];
  if (!node.parentId) return addChild(data, id, text);
  const parent = data.nodes[node.parentId];
  const idx = parent.children.indexOf(id);
  return addChild(
    data,
    node.parentId,
    text,
    before ? idx : idx + 1,
    node.side
  );
}

export function addParent(
  data: MindMapData,
  id: string,
  text = ""
): { data: MindMapData; id: string } | null {
  const node = data.nodes[id];
  if (!node.parentId) return null;
  const parent = data.nodes[node.parentId];
  const idx = parent.children.indexOf(id);
  const res = addChild(data, node.parentId, text, idx, node.side);
  const moved = moveNode(res.data, id, res.id, 0);
  return { data: moved, id: res.id };
}

export function updateNode(
  data: MindMapData,
  id: string,
  patch: Partial<MindNode>
): MindMapData {
  return patchNode(data, id, patch);
}

export function collectSubtree(data: MindMapData, id: string): string[] {
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    const n = data.nodes[cur];
    if (!n) continue;
    out.push(cur);
    stack.push(...n.children);
  }
  return out;
}

export function deleteNode(data: MindMapData, id: string): MindMapData {
  const node = data.nodes[id];
  if (!node || !node.parentId) return data;
  const next = clone(data);
  const parent = { ...next.nodes[node.parentId] };
  parent.children = parent.children.filter((c) => c !== id);
  next.nodes[node.parentId] = parent;
  for (const d of collectSubtree(data, id)) delete next.nodes[d];
  return next;
}

/** Move node under newParent at index. No-op if it would create a cycle. */
export function moveNode(
  data: MindMapData,
  id: string,
  newParentId: string,
  index?: number,
  side?: Side
): MindMapData {
  const node = data.nodes[id];
  if (!node || !node.parentId) return data;
  if (id === newParentId || isAncestor(data, id, newParentId)) return data;

  const next = clone(data);
  const oldParent = { ...next.nodes[node.parentId] };
  const oldIdx = oldParent.children.indexOf(id);
  oldParent.children = oldParent.children.filter((c) => c !== id);
  next.nodes[oldParent.id] = oldParent;

  const newParent = { ...next.nodes[newParentId] };
  const children = [...newParent.children];
  let at = index ?? children.length;
  if (oldParent.id === newParentId && oldIdx < at) at--;
  at = Math.max(0, Math.min(children.length, at));
  children.splice(at, 0, id);
  newParent.children = children;
  newParent.collapsed = false;
  next.nodes[newParentId] = newParent;

  const moved: MindNode = { ...node, parentId: newParentId };
  if (newParentId === data.rootId) {
    moved.side = side ?? node.side ?? balancedSide(data);
  } else {
    delete moved.side;
  }
  next.nodes[id] = moved;
  return next;
}

/** Move a node up/down among its siblings. */
export function shiftNode(
  data: MindMapData,
  id: string,
  delta: number
): MindMapData {
  const node = data.nodes[id];
  if (!node.parentId) return data;
  const parent = data.nodes[node.parentId];
  const idx = parent.children.indexOf(id);
  const to = idx + delta;
  if (to < 0 || to >= parent.children.length) return data;
  const children = [...parent.children];
  children.splice(idx, 1);
  children.splice(to, 0, id);
  return patchNode(data, parent.id, { children });
}

export function toggleCollapse(data: MindMapData, id: string): MindMapData {
  const n = data.nodes[id];
  if (!n.children.length || !n.parentId) return data;
  return patchNode(data, id, { collapsed: !n.collapsed });
}

export function setCollapseAll(
  data: MindMapData,
  collapsed: boolean,
  minDepth = 1
): MindMapData {
  const next = clone(data);
  for (const id of Object.keys(next.nodes)) {
    const n = next.nodes[id];
    if (!n.children.length || !n.parentId) continue;
    const want = collapsed && depthOf(data, id) >= minDepth;
    if (!!n.collapsed !== want) next.nodes[id] = { ...n, collapsed: want };
  }
  return next;
}

// ───────────── Clipboard (subtrees) ─────────────

export interface Subtree {
  rootId: string;
  nodes: Record<string, MindNode>;
}

export function extractSubtree(data: MindMapData, id: string): Subtree {
  const nodes: Record<string, MindNode> = {};
  for (const d of collectSubtree(data, id)) nodes[d] = data.nodes[d];
  return { rootId: id, nodes };
}

/** Paste a subtree as the last child of parentId, with fresh ids. */
export function pasteSubtree(
  data: MindMapData,
  parentId: string,
  sub: Subtree,
  index?: number
): { data: MindMapData; id: string } {
  const map = new Map<string, string>();
  for (const old of Object.keys(sub.nodes)) map.set(old, uid());
  const next = clone(data);
  for (const [old, n] of Object.entries(sub.nodes)) {
    const fresh: MindNode = {
      ...n,
      id: map.get(old)!,
      parentId: n.parentId && map.has(n.parentId) ? map.get(n.parentId)! : parentId,
      children: n.children.filter((c) => map.has(c)).map((c) => map.get(c)!),
    };
    if (old === sub.rootId) {
      if (parentId === data.rootId) fresh.side = n.side ?? balancedSide(data);
      else delete fresh.side;
    }
    next.nodes[fresh.id] = fresh;
  }
  const newRoot = map.get(sub.rootId)!;
  const parent = { ...next.nodes[parentId] };
  const children = [...parent.children];
  children.splice(index ?? children.length, 0, newRoot);
  parent.children = children;
  parent.collapsed = false;
  next.nodes[parentId] = parent;
  return { data: next, id: newRoot };
}

// ───────────── Text import / export ─────────────

export function toMarkdown(data: MindMapData): string {
  const lines: string[] = [];
  const walk = (id: string, depth: number) => {
    const n = data.nodes[id];
    const label = [
      n.task ? (n.task.done ? "[x] " : "[ ] ") : "",
      n.icon ? n.icon + " " : "",
      n.link ? `[${n.text || n.link}](${n.link})` : n.text.replace(/\n/g, " "),
    ].join("");
    if (depth === 0) lines.push(`# ${label}`, "");
    else lines.push(`${"  ".repeat(depth - 1)}- ${label}`);
    if (n.note) {
      const pad = depth === 0 ? "" : "  ".repeat(depth);
      for (const l of n.note.split("\n")) lines.push(`${pad}> ${l}`);
    }
    n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(data.rootId, 0);
  return lines.join("\n") + "\n";
}

export function toPlainOutline(data: MindMapData): string {
  const lines: string[] = [];
  const walk = (id: string, depth: number) => {
    const n = data.nodes[id];
    lines.push("\t".repeat(depth) + n.text.replace(/\n/g, " "));
    n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(data.rootId, 0);
  return lines.join("\n") + "\n";
}

/**
 * Parse an indented outline (tabs, spaces, "-", "*", "#" headings) into a map.
 * The first line becomes the central idea.
 */
export function fromOutline(text: string): MindMapData | null {
  const raw = text
    .split(/\r?\n/)
    .filter((l) => l.trim() && !/^\s*>/.test(l));
  if (!raw.length) return null;

  const parsed = raw.map((line) => {
    const heading = line.match(/^(#+)\s+(.*)$/);
    if (heading) return { level: heading[1].length - 1, text: heading[2] };
    const m = line.match(/^(\s*)(?:[-*+]|\d+[.)])?\s*(.*)$/)!;
    const ws = m[1].replace(/\t/g, "    ").length;
    return { level: Math.floor(ws / 2) + 100, text: m[2] }; // bullets sit under headings
  });

  // Normalise levels to consecutive depths.
  const first = parsed[0];
  const data = createMap(cleanLabel(first.text) || "Central Idea");
  const stack: { level: number; id: string }[] = [
    { level: first.level, id: data.rootId },
  ];
  let cur = data;
  for (const p of parsed.slice(1)) {
    while (stack.length > 1 && stack[stack.length - 1].level >= p.level) {
      stack.pop();
    }
    const parentId = stack[stack.length - 1].id;
    const res = addChild(cur, parentId, cleanLabel(p.text));
    cur = res.data;
    const label = p.text;
    const task = label.match(/^\[( |x|X)\]\s*/);
    if (task) {
      cur = updateNode(cur, res.id, { task: { done: task[1] !== " " } });
    }
    stack.push({ level: p.level, id: res.id });
  }
  return cur;
}

function cleanLabel(s: string): string {
  return s
    .replace(/^\[( |x|X)\]\s*/, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .trim();
}

export function countNodes(data: MindMapData): number {
  return Object.keys(data.nodes).length;
}

/** Defensive validation for data coming from storage / imports. */
export function sanitizeMap(input: unknown): MindMapData | null {
  if (!input || typeof input !== "object") return null;
  const d = input as MindMapData;
  if (typeof d.rootId !== "string" || !d.nodes || !d.nodes[d.rootId]) {
    return null;
  }
  const nodes: Record<string, MindNode> = {};
  const seen = new Set<string>();
  const walk = (id: string, parentId: string | null) => {
    const n = d.nodes[id];
    if (!n || seen.has(id)) return;
    seen.add(id);
    const children = Array.isArray(n.children) ? n.children : [];
    nodes[id] = {
      ...n,
      id,
      parentId,
      text: typeof n.text === "string" ? n.text : "",
      children: children.filter((c) => d.nodes[c] && !seen.has(c)),
    };
    nodes[id].children.forEach((c) => walk(c, id));
    nodes[id].children = nodes[id].children.filter((c) => nodes[c]);
  };
  walk(d.rootId, null);
  return { rootId: d.rootId, nodes };
}
