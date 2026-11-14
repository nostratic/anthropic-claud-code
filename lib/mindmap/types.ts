// Core data model for the mind-map editor.
// A map is a flat dictionary of nodes plus a root id; each node keeps an
// ordered list of child ids. This makes edits (move, reorder, delete) cheap
// and keeps the JSON stored in the DB compact.

export type NodeShape = "rounded" | "rect" | "pill" | "underline" | "none";
export type LayoutMode = "mindmap" | "right" | "left" | "org";
export type Side = "left" | "right";
export type Priority = 1 | 2 | 3;

export interface NodeStyle {
  /** Branch/fill color override (hex). Inherited by descendants when set. */
  color?: string;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  shape?: NodeShape;
  fontScale?: number; // 0.8 .. 2
}

export interface NodeTask {
  done: boolean;
  priority?: Priority;
  due?: string; // yyyy-mm-dd
  progress?: number; // 0..100
}

export interface MindNode {
  id: string;
  text: string;
  children: string[];
  parentId: string | null;
  collapsed?: boolean;
  /** Only meaningful for first-level children in "mindmap" layout. */
  side?: Side;
  style?: NodeStyle;
  icon?: string; // emoji
  note?: string;
  link?: string;
  image?: string; // image URL
  task?: NodeTask;
}

export interface MindMapData {
  rootId: string;
  nodes: Record<string, MindNode>;
}

export interface MindMapRecord {
  id: string;
  title: string;
  theme: string;
  layout: LayoutMode;
  version: number;
  data: MindMapData;
  ownerId: string;
  role: "owner" | "editor" | "viewer";
  updatedAt: string;
  owner?: { id: string; name: string; email: string };
  collaborators?: {
    id: string;
    role: string;
    user: { id: string; name: string; email: string };
  }[];
}

export interface MindMapSummary {
  id: string;
  title: string;
  theme: string;
  updatedAt: string;
  createdAt: string;
  nodeCount: number;
  role: "owner" | "editor" | "viewer";
  owner: { id: string; name: string };
}
