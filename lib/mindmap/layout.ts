// Measures topics with a canvas (so layout is deterministic and the same
// numbers can drive both the DOM view and SVG/PNG export) and computes
// positions for each layout mode.

import type { LayoutMode, MindMapData, MindNode, NodeShape, Side } from "./types";
import { readableText, type MapTheme } from "./themes";

export const FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const ICON_SIZE = 18;
export const BADGE_SIZE = 16;
export const IMAGE_H = 96;
export const IMAGE_W = 150;

export interface NodeBox {
  id: string;
  x: number; // top-left
  y: number;
  w: number;
  h: number;
  depth: number;
  side: Side;
  color: string; // branch color
  bg: string;
  text: string; // text color
  border: string;
  shape: NodeShape;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  lines: string[];
  lineHeight: number;
  padX: number;
  padY: number;
  textW: number;
  badges: ("note" | "link")[];
  hiddenChildren: number; // >0 when collapsed
}

export interface Edge {
  from: string;
  to: string;
  d: string;
  color: string;
  width: number;
}

export interface LayoutResult {
  boxes: Record<string, NodeBox>;
  order: string[]; // render order (parents before children)
  edges: Edge[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

// ───────────── Text measurement ─────────────

let ctx: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();

function measure(text: string, font: string): number {
  const key = font + "|" + text;
  const hit = widthCache.get(key);
  if (hit !== undefined) return hit;
  if (!ctx && typeof document !== "undefined") {
    ctx = document.createElement("canvas").getContext("2d");
  }
  let w: number;
  if (ctx) {
    ctx.font = font;
    w = ctx.measureText(text).width;
  } else {
    // Server-side fallback; layout is recomputed on the client anyway.
    const size = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? "14");
    w = text.length * size * 0.55;
  }
  if (widthCache.size > 20000) widthCache.clear();
  widthCache.set(key, w);
  return w;
}

export function fontString(size: number, weight: number, italic: boolean) {
  return `${italic ? "italic " : ""}${weight} ${size}px ${FONT_FAMILY}`;
}

export function wrapText(text: string, font: string, maxW: number): string[] {
  const out: string[] = [];
  const paragraphs = (text || "").split("\n");
  for (const para of paragraphs) {
    const words = para.split(/(\s+)/).filter((w) => w.length);
    let line = "";
    for (const word of words) {
      const candidate = line + word;
      if (measure(candidate.trimEnd(), font) <= maxW || !line.trim()) {
        if (!line.trim() && measure(word, font) > maxW) {
          // Break a very long word into chunks.
          let chunk = line;
          for (const ch of word) {
            if (measure(chunk + ch, font) > maxW && chunk) {
              out.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          line = chunk;
        } else {
          line = candidate;
        }
      } else {
        out.push(line.trimEnd());
        line = word.trimStart();
      }
    }
    out.push(line.trimEnd());
  }
  return out.length ? out : [""];
}

// ───────────── Styling resolution ─────────────

interface Resolved {
  color: string;
  bg: string;
  text: string;
  border: string;
  shape: NodeShape;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  padX: number;
  padY: number;
  maxW: number;
}

function resolveStyle(
  node: MindNode,
  depth: number,
  branchColor: string,
  theme: MapTheme
): Resolved {
  const s = node.style ?? {};
  const scale = s.fontScale ?? 1;
  let r: Resolved;
  if (depth === 0) {
    const bg = s.color ?? theme.rootBg;
    r = {
      color: bg,
      bg,
      text: s.textColor ?? (s.color ? readableText(bg) : theme.rootText),
      border: theme.rootBg === "#ffffff" ? "#111827" : bg,
      shape: s.shape ?? "rounded",
      fontSize: 22,
      fontWeight: 700,
      italic: false,
      padX: 24,
      padY: 14,
      maxW: 320,
    };
  } else if (depth === 1) {
    const filled = theme.level1 === "filled";
    const bg = filled ? branchColor : theme.deepBg === "transparent" ? theme.canvas : theme.deepBg;
    r = {
      color: branchColor,
      bg,
      text: s.textColor ?? (filled ? readableText(branchColor) : theme.deepText),
      border: branchColor,
      shape: s.shape ?? (filled ? "rounded" : "pill"),
      fontSize: 16,
      fontWeight: 600,
      italic: false,
      padX: 16,
      padY: 9,
      maxW: 260,
    };
  } else {
    r = {
      color: branchColor,
      bg: theme.deepBg,
      text: s.textColor ?? theme.deepText,
      border: branchColor,
      shape: s.shape ?? theme.deepShape,
      fontSize: 14,
      fontWeight: 400,
      italic: false,
      padX: 12,
      padY: 7,
      maxW: 240,
    };
    if (s.color && r.shape !== "underline" && r.shape !== "none") {
      r.bg = s.color;
      r.text = s.textColor ?? readableText(s.color);
    }
  }
  if (r.shape === "underline" || r.shape === "none") {
    r.bg = "transparent";
    r.padX = Math.min(r.padX, 6);
  }
  r.fontSize = Math.round(r.fontSize * scale);
  if (s.bold) r.fontWeight = 700;
  if (s.bold === false) r.fontWeight = depth === 0 ? 600 : 400;
  if (s.italic) r.italic = true;
  return r;
}

// ───────────── Main layout ─────────────

const H_GAP = 56; // parent→child horizontal distance
const V_GAP = 14; // between sibling subtrees
const ORG_V_GAP = 56;
const ORG_H_GAP = 24;

export function computeLayout(
  data: MindMapData,
  theme: MapTheme,
  mode: LayoutMode,
  overrides?: { id: string; text: string } | null
): LayoutResult {
  const boxes: Record<string, NodeBox> = {};
  const order: string[] = [];
  const root = data.nodes[data.rootId];

  // 1. Measure every visible node.
  const visit = (id: string, depth: number, branchColor: string, branchIdx: number) => {
    const n = data.nodes[id];
    if (!n) return;
    let color = branchColor;
    if (depth === 1) color = theme.palette[branchIdx % theme.palette.length];
    if (n.style?.color && depth > 0) color = n.style.color;
    const st = resolveStyle(n, depth, color, theme);
    const text = overrides?.id === id ? overrides.text : n.text;
    const font = fontString(st.fontSize, st.fontWeight, st.italic);
    const lines = wrapText(text || " ", font, st.maxW);
    const textW = Math.max(
      st.fontSize * 1.2,
      ...lines.map((l) => measure(l, font))
    );
    const lineHeight = Math.round(st.fontSize * 1.35);
    const badges: NodeBox["badges"] = [];
    if (n.note) badges.push("note");
    if (n.link) badges.push("link");
    let contentW = textW;
    if (n.icon) contentW += ICON_SIZE + 6;
    if (n.task) contentW += 16 + 6;
    contentW += badges.length * (BADGE_SIZE + 4) + (badges.length ? 2 : 0);
    let w = Math.ceil(contentW + st.padX * 2);
    let h = Math.ceil(lines.length * lineHeight + st.padY * 2);
    if (n.image) {
      w = Math.max(w, IMAGE_W + st.padX * 2);
      h += IMAGE_H + 6;
    }
    if (n.task && !n.task.done && (n.task.progress ?? 0) > 0) h += 6;
    const hiddenChildren =
      n.collapsed && n.parentId ? countDescendants(data, id) : 0;
    boxes[id] = {
      id,
      x: 0,
      y: 0,
      w,
      h,
      depth,
      side: depth === 0 ? "right" : "right",
      color,
      bg: st.bg,
      text: st.text,
      border: st.border,
      shape: st.shape,
      fontSize: st.fontSize,
      fontWeight: st.fontWeight,
      italic: st.italic,
      lines,
      lineHeight,
      padX: st.padX,
      padY: st.padY,
      textW,
      badges,
      hiddenChildren,
    };
    order.push(id);
    if (n.collapsed && n.parentId) return;
    n.children.forEach((c, i) => visit(c, depth + 1, color, depth === 0 ? i : branchIdx));
  };
  visit(data.rootId, 0, theme.rootBg, 0);

  const kids = (id: string) => {
    const n = data.nodes[id];
    if (!n || (n.collapsed && n.parentId)) return [];
    return n.children.filter((c) => boxes[c]);
  };

  const rootBox = boxes[data.rootId];
  rootBox.x = -rootBox.w / 2;
  rootBox.y = -rootBox.h / 2;

  if (mode === "org") {
    layoutOrg(data.rootId, boxes, kids);
  } else {
    const all = kids(data.rootId);
    let rightKids: string[];
    let leftKids: string[];
    if (mode === "right") {
      rightKids = all;
      leftKids = [];
    } else if (mode === "left") {
      rightKids = [];
      leftKids = all;
    } else {
      rightKids = all.filter((c) => data.nodes[c].side !== "left");
      leftKids = all.filter((c) => data.nodes[c].side === "left");
    }
    placeSide(rootBox, rightKids, "right", boxes, kids);
    placeSide(rootBox, leftKids, "left", boxes, kids);
  }

  // 2. Edges
  const edges: Edge[] = [];
  for (const id of order) {
    const b = boxes[id];
    for (const c of kids(id)) {
      const cb = boxes[c];
      edges.push({
        from: id,
        to: c,
        d: mode === "org" ? orgPath(b, cb) : horizontalPath(b, cb, theme),
        color: cb.color,
        width: cb.depth === 1 ? 3.5 : cb.depth === 2 ? 2.4 : 1.6,
      });
    }
  }

  // 3. Bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const id of order) {
    const b = boxes[id];
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w + (b.hiddenChildren ? 26 : 0));
    maxY = Math.max(maxY, b.y + b.h);
  }
  void root;
  return { boxes, order, edges, bounds: { minX, minY, maxX, maxY } };
}

function countDescendants(data: MindMapData, id: string): number {
  let n = 0;
  const stack = [...data.nodes[id].children];
  while (stack.length) {
    const c = stack.pop()!;
    n++;
    stack.push(...(data.nodes[c]?.children ?? []));
  }
  return n;
}

// Horizontal tree for one side of the root.
function placeSide(
  rootBox: NodeBox,
  children: string[],
  side: Side,
  boxes: Record<string, NodeBox>,
  kids: (id: string) => string[]
) {
  if (!children.length) return;
  const heights = new Map<string, number>();
  const subtreeH = (id: string): number => {
    const b = boxes[id];
    const ks = kids(id);
    let total = 0;
    ks.forEach((k, i) => {
      total += subtreeH(k) + (i ? V_GAP : 0);
    });
    const h = Math.max(b.h, total);
    heights.set(id, h);
    return h;
  };
  let total = 0;
  children.forEach((c, i) => {
    total += subtreeH(c) + (i ? V_GAP * 1.6 : 0);
  });

  const place = (id: string, parent: NodeBox, top: number) => {
    const b = boxes[id];
    const h = heights.get(id)!;
    b.side = side;
    const gap = b.depth === 1 ? H_GAP + 20 : H_GAP;
    b.x = side === "right" ? parent.x + parent.w + gap : parent.x - gap - b.w;
    b.y = top + (h - b.h) / 2;
    const ks = kids(id);
    let childTotal = 0;
    ks.forEach((k, i) => (childTotal += heights.get(k)! + (i ? V_GAP : 0)));
    let cy = top + (h - childTotal) / 2;
    for (const k of ks) {
      place(k, b, cy);
      cy += heights.get(k)! + V_GAP;
    }
  };

  let y = rootBox.y + rootBox.h / 2 - total / 2;
  for (const c of children) {
    place(c, rootBox, y);
    y += heights.get(c)! + V_GAP * 1.6;
  }
}

function layoutOrg(
  rootId: string,
  boxes: Record<string, NodeBox>,
  kids: (id: string) => string[]
) {
  const widths = new Map<string, number>();
  const subtreeW = (id: string): number => {
    const ks = kids(id);
    let total = 0;
    ks.forEach((k, i) => (total += subtreeW(k) + (i ? ORG_H_GAP : 0)));
    const w = Math.max(boxes[id].w, total);
    widths.set(id, w);
    return w;
  };
  subtreeW(rootId);
  const place = (id: string, left: number, top: number) => {
    const b = boxes[id];
    const w = widths.get(id)!;
    b.x = left + (w - b.w) / 2;
    b.y = top;
    b.side = "right";
    const ks = kids(id);
    let total = 0;
    ks.forEach((k, i) => (total += widths.get(k)! + (i ? ORG_H_GAP : 0)));
    let cx = left + (w - total) / 2;
    for (const k of ks) {
      place(k, cx, top + b.h + ORG_V_GAP);
      cx += widths.get(k)! + ORG_H_GAP;
    }
  };
  const rb = boxes[rootId];
  const w = widths.get(rootId)!;
  place(rootId, -w / 2, rb.y);
}

function anchorY(b: NodeBox): number {
  return b.shape === "underline" ? b.y + b.h : b.y + b.h / 2;
}

function horizontalPath(p: NodeBox, c: NodeBox, theme: MapTheme): string {
  const right = c.side === "right";
  // Start from the parent's edge (root: from its center so branches fan out).
  const sx = p.depth === 0 ? p.x + p.w / 2 + (right ? p.w / 2 - 8 : -p.w / 2 + 8) : right ? p.x + p.w : p.x;
  const sy = p.depth === 0 ? p.y + p.h / 2 : anchorY(p);
  const ex = right ? c.x : c.x + c.w;
  const ey = anchorY(c);
  let tail = "";
  if (c.shape === "underline") {
    // Continue the line under the text.
    tail = ` L ${right ? c.x + c.w : c.x} ${ey}`;
  }
  if (theme.connector === "straight") {
    const mx = sx + (ex - sx) * 0.5;
    return `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ey} L ${ex} ${ey}${tail}`;
  }
  const dx = (ex - sx) * 0.55;
  return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${ex - dx} ${ey}, ${ex} ${ey}${tail}`;
}

function orgPath(p: NodeBox, c: NodeBox): string {
  const sx = p.x + p.w / 2;
  const sy = p.y + p.h;
  const ex = c.x + c.w / 2;
  const ey = c.y;
  const my = sy + (ey - sy) / 2;
  return `M ${sx} ${sy} C ${sx} ${my}, ${ex} ${my}, ${ex} ${ey}`;
}
