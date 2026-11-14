"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Plus,
  CornerDownRight,
  Trash2,
  Download,
  Upload,
  Share2,
  ZoomIn,
  ZoomOut,
  Maximize,
  ListTree,
  PanelRight,
  Search,
  Keyboard,
  Loader2,
  Check,
  AlertTriangle,
  ChevronsDownUp,
  ChevronsUpDown,
  Eye,
} from "lucide-react";
import type { LayoutMode, MindMapData, MindMapRecord, MindNode, Side } from "@/lib/mindmap/types";
import * as M from "@/lib/mindmap/model";
import { computeLayout, type LayoutResult, type NodeBox } from "@/lib/mindmap/layout";
import { getTheme, THEMES } from "@/lib/mindmap/themes";
import { exportJSON, exportMarkdown, exportPNG, exportSVG, exportText } from "@/lib/mindmap/exporters";
import { NodeView } from "./NodeView";
import { Inspector, LAYOUTS, type InspectorTab } from "./Inspector";
import { OutlinePanel } from "./OutlinePanel";
import { ImportDialog, ShareDialog, ShortcutsDialog } from "./Dialogs";
import { cn } from "@/lib/utils";

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

interface View {
  x: number;
  y: number;
  scale: number;
}

interface DropTarget {
  parentId: string;
  index: number;
  side?: Side;
  /** Visual hint */
  mode: "into" | "before" | "after";
  refId: string;
}

interface DragState {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  worldX: number;
  worldY: number;
  offX: number;
  offY: number;
  active: boolean;
  target: DropTarget | null;
}

const MAX_HISTORY = 200;
const MIN_SCALE = 0.2;
const MAX_SCALE = 3;

export function MindMapEditor({ initial }: { initial: MindMapRecord }) {
  const readOnly = initial.role === "viewer";

  // ───────── Document state ─────────
  const [data, setData] = useState<MindMapData>(initial.data);
  const [title, setTitle] = useState(initial.title);
  const [themeId, setThemeId] = useState(initial.theme);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(initial.layout);
  const [mapMeta, setMapMeta] = useState(initial);
  // The title follows the central topic until the user renames the map.
  const titleLinked = useRef(initial.title === initial.data.nodes[initial.data.rootId]?.text);
  const rootText = data.nodes[data.rootId]?.text ?? "";
  useEffect(() => {
    if (titleLinked.current && rootText.trim()) setTitle(rootText.replace(/\s+/g, " ").slice(0, 200));
  }, [rootText]);

  const dataRef = useRef(data);
  dataRef.current = data;

  // ───────── History ─────────
  const past = useRef<MindMapData[]>([]);
  const future = useRef<MindMapData[]>([]);
  const lastCoalesce = useRef<{ key: string; t: number } | null>(null);
  const [, forceRender] = useState(0);

  const commit = useCallback(
    (next: MindMapData, coalesceKey?: string) => {
      if (readOnly || next === dataRef.current) return;
      const now = Date.now();
      const lc = lastCoalesce.current;
      const coalesce = coalesceKey && lc && lc.key === coalesceKey && now - lc.t < 1500;
      if (!coalesce) {
        past.current.push(dataRef.current);
        if (past.current.length > MAX_HISTORY) past.current.shift();
      }
      lastCoalesce.current = coalesceKey ? { key: coalesceKey, t: now } : null;
      future.current = [];
      dataRef.current = next;
      setData(next);
    },
    [readOnly]
  );

  // ───────── Selection / editing ─────────
  const [selectedId, setSelectedId] = useState<string | null>(initial.data.rootId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  /** Node created by the current edit session (removed again on Esc). */
  const newNodeRef = useRef<{ id: string; before: MindMapData } | null>(null);

  // ───────── UI state ─────────
  const [showInspector, setShowInspector] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("style");
  const [showOutline, setShowOutline] = useState(false);
  const [dialog, setDialog] = useState<null | "share" | "shortcuts" | "import">(null);
  const [menu, setMenu] = useState<null | "export" | "layout">(null);
  const [search, setSearch] = useState<string | null>(null);
  const [searchIdx, setSearchIdx] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const theme = getTheme(themeId);

  // ───────── Layout ─────────
  const layout: LayoutResult = useMemo(
    () => computeLayout(data, theme, layoutMode, editingId ? { id: editingId, text: draft } : null),
    [data, theme, layoutMode, editingId, draft]
  );
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // ───────── View (pan / zoom) ─────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const didInitView = useRef(false);

  const fitToScreen = useCallback((maxScale = 1) => {
    const el = containerRef.current;
    if (!el) return;
    const { minX, minY, maxX, maxY } = layoutRef.current.bounds;
    const pad = 60;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const scale = Math.max(
      MIN_SCALE,
      Math.min(maxScale, (w - pad * 2) / (maxX - minX || 1), (h - pad * 2) / (maxY - minY || 1))
    );
    setView({
      scale,
      x: w / 2 - ((minX + maxX) / 2) * scale,
      y: h / 2 - ((minY + maxY) / 2) * scale,
    });
  }, []);

  useLayoutEffect(() => {
    if (didInitView.current) return;
    didInitView.current = true;
    fitToScreen(1);
  }, [fitToScreen]);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const el = containerRef.current;
    if (!el) return;
    setView((v) => {
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor));
      const px = cx ?? el.clientWidth / 2;
      const py = cy ?? el.clientHeight / 2;
      const k = scale / v.scale;
      return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  }, []);

  const centerOn = useCallback((id: string, onlyIfHidden = true) => {
    const el = containerRef.current;
    const b = layoutRef.current.boxes[id];
    if (!el || !b) return;
    const v = viewRef.current;
    const sx = v.x + b.x * v.scale;
    const sy = v.y + b.y * v.scale;
    const margin = 40;
    const visible =
      sx > margin &&
      sy > margin &&
      sx + b.w * v.scale < el.clientWidth - margin &&
      sy + b.h * v.scale < el.clientHeight - margin;
    if (onlyIfHidden && visible) return;
    setView({
      ...v,
      x: el.clientWidth / 2 - (b.x + b.w / 2) * v.scale,
      y: el.clientHeight / 2 - (b.y + b.h / 2) * v.scale,
    });
  }, []);

  // Keep the selected/edited node in view after layout changes.
  useEffect(() => {
    const id = editingId ?? selectedId;
    if (id) centerOn(id, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, editingId]);

  // ───────── Autosave ─────────
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const versionRef = useRef(initial.version);
  /** Snapshot of what the server currently has; autosave only runs when we differ. */
  const lastSaved = useRef({ data: initial.data, title: initial.title, themeId: initial.theme, layoutMode: initial.layout });
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const latestDoc = useRef({ data, title, themeId, layoutMode });
  latestDoc.current = { data, title, themeId, layoutMode };

  const save = useCallback(async () => {
    if (readOnly) return;
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    savingRef.current = true;
    setSaveState("saving");
    const doc = latestDoc.current;
    try {
      const res = await fetch(`/api/maps/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: doc.data,
          title: doc.title.trim() || "Untitled map",
          theme: doc.themeId,
          layout: doc.layoutMode,
          baseVersion: versionRef.current,
        }),
      });
      if (res.status === 409) {
        setSaveState("conflict");
        pendingRef.current = false;
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      versionRef.current = body.version;
      lastSaved.current = doc;
      setSaveState(pendingRef.current ? "dirty" : "saved");
    } catch {
      setSaveState("error");
    } finally {
      savingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void save();
      }
    }
  }, [initial.id, readOnly]);

  useEffect(() => {
    const ls = lastSaved.current;
    if (ls.data === data && ls.title === title && ls.themeId === themeId && ls.layoutMode === layoutMode) return;
    if (readOnly || saveState === "conflict") return;
    setSaveState((s) => (s === "saving" ? s : "dirty"));
    const t = setTimeout(() => void save(), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, title, themeId, layoutMode]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving" || saveState === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  }, []);

  // ───────── Editing actions ─────────
  const startEdit = useCallback(
    (id: string, initialText?: string) => {
      if (readOnly) return;
      const n = dataRef.current.nodes[id];
      if (!n) return;
      setSelectedId(id);
      setDraft(initialText ?? n.text);
      draftRef.current = initialText ?? n.text;
      editingIdRef.current = id;
      setEditingId(id);
    },
    [readOnly]
  );

  const editingIdRef = useRef<string | null>(null);
  editingIdRef.current = editingId;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const finishEdit = useCallback(
    (opts?: { cancel?: boolean }) => {
      const id = editingIdRef.current;
      if (!id) return null;
      // Clear synchronously so a trailing blur event can't commit twice.
      editingIdRef.current = null;
      setEditingId(null);
      const created = newNodeRef.current?.id === id ? newNodeRef.current : null;
      newNodeRef.current = null;
      const text = draftRef.current.replace(/\s+$/, "");
      if (created && (opts?.cancel || !text.trim())) {
        // Discard a freshly-created empty topic entirely (and its history entry).
        const parentId = dataRef.current.nodes[id]?.parentId ?? null;
        past.current.pop();
        dataRef.current = created.before;
        setData(created.before);
        setSelectedId(parentId);
        return null;
      }
      if (opts?.cancel) return id;
      const cur = dataRef.current.nodes[id];
      if (cur && cur.text !== text) {
        const next = M.updateNode(dataRef.current, id, { text });
        if (created) {
          // Merge "add topic" + "type text" into a single undo step.
          dataRef.current = next;
          setData(next);
        } else {
          commit(next);
        }
      }
      return id;
    },
    [commit]
  );

  const addAndEdit = useCallback(
    (kind: "child" | "sibling" | "siblingBefore" | "parent", fromId?: string) => {
      if (readOnly) return;
      const base = dataRef.current;
      const id = fromId ?? selectedId ?? base.rootId;
      if (!base.nodes[id]) return;
      let res: { data: MindMapData; id: string } | null = null;
      if (kind === "child") res = M.addChild(base, id);
      else if (kind === "sibling") res = M.addSibling(base, id);
      else if (kind === "siblingBefore") res = M.addSibling(base, id, "", true);
      else res = M.addParent(base, id);
      if (!res) return;
      commit(res.data);
      newNodeRef.current = { id: res.id, before: base };
      setSelectedId(res.id);
      setDraft("");
      draftRef.current = "";
      editingIdRef.current = res.id;
      setEditingId(res.id);
    },
    [commit, readOnly, selectedId]
  );

  const deleteSelected = useCallback(() => {
    if (readOnly || !selectedId) return;
    const d = dataRef.current;
    const n = d.nodes[selectedId];
    if (!n || !n.parentId) return;
    const siblings = d.nodes[n.parentId].children;
    const idx = siblings.indexOf(selectedId);
    const nextSel = siblings[idx + 1] ?? siblings[idx - 1] ?? n.parentId;
    commit(M.deleteNode(d, selectedId));
    setSelectedId(nextSel);
  }, [commit, readOnly, selectedId]);

  const patchSelected = useCallback(
    (patch: Partial<MindNode>, coalesceKey?: string) => {
      if (!selectedId) return;
      commit(M.updateNode(dataRef.current, selectedId, patch), coalesceKey);
    },
    [commit, selectedId]
  );

  const undo = useCallback(() => {
    if (editingId) return;
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(dataRef.current);
    lastCoalesce.current = null;
    dataRef.current = prev;
    setData(prev);
    if (selectedId && !prev.nodes[selectedId]) setSelectedId(prev.rootId);
    forceRender((n) => n + 1);
  }, [editingId, selectedId]);

  const redo = useCallback(() => {
    if (editingId) return;
    const next = future.current.pop();
    if (!next) return;
    past.current.push(dataRef.current);
    lastCoalesce.current = null;
    dataRef.current = next;
    setData(next);
    if (selectedId && !next.nodes[selectedId]) setSelectedId(next.rootId);
    forceRender((n) => n + 1);
  }, [editingId, selectedId]);

  // ───────── Clipboard ─────────
  const clipboard = useRef<{ sub: M.Subtree; text: string } | null>(null);

  const copySelected = useCallback(
    (cut = false) => {
      if (!selectedId) return;
      const d = dataRef.current;
      const sub = M.extractSubtree(d, selectedId);
      const text = M.toPlainOutline({ rootId: selectedId, nodes: sub.nodes });
      clipboard.current = { sub, text };
      navigator.clipboard?.writeText(text).catch(() => undefined);
      if (cut && d.nodes[selectedId].parentId) {
        deleteSelected();
        showToast("Branch cut");
      } else {
        showToast("Branch copied");
      }
    },
    [selectedId, deleteSelected, showToast]
  );

  const pasteInto = useCallback(
    (text: string | null) => {
      if (readOnly) return;
      const d = dataRef.current;
      const target = selectedId ?? d.rootId;
      let sub: M.Subtree | null = null;
      const cb = clipboard.current;
      if (cb && (text === null || text === cb.text)) {
        sub = cb.sub;
      } else if (text && text.trim()) {
        const parsed = M.fromOutline(text);
        if (parsed) {
          // A multi-line paste whose first line is a lone heading keeps its structure.
          sub = { rootId: parsed.rootId, nodes: parsed.nodes };
        }
      }
      if (!sub) return;
      const res = M.pasteSubtree(d, target, sub);
      commit(res.data);
      setSelectedId(res.id);
    },
    [commit, readOnly, selectedId]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (editingId || isTypingTarget(e.target)) return;
      e.preventDefault();
      pasteInto(e.clipboardData?.getData("text/plain") ?? null);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [editingId, pasteInto]);

  // ───────── Search ─────────
  const searchHits = useMemo(() => {
    if (!search || !search.trim()) return [] as string[];
    const q = search.toLowerCase();
    const out: string[] = [];
    const walk = (id: string) => {
      const n = data.nodes[id];
      if (n.text.toLowerCase().includes(q) || n.note?.toLowerCase().includes(q)) out.push(id);
      n.children.forEach(walk);
    };
    walk(data.rootId);
    return out;
  }, [search, data]);
  const searchHitSet = useMemo(() => new Set(searchHits), [searchHits]);

  const revealNode = useCallback(
    (id: string) => {
      // Expand collapsed ancestors so the node becomes visible.
      let d = dataRef.current;
      let cur = d.nodes[id];
      let changed = false;
      while (cur?.parentId) {
        const p = d.nodes[cur.parentId];
        if (p.collapsed) {
          d = M.updateNode(d, p.id, { collapsed: false });
          changed = true;
        }
        cur = p;
      }
      if (changed) {
        dataRef.current = d;
        setData(d);
      }
      setSelectedId(id);
      requestAnimationFrame(() => centerOn(id, false));
    },
    [centerOn]
  );

  const gotoHit = useCallback(
    (delta: number) => {
      if (!searchHits.length) return;
      const i = (searchIdx + delta + searchHits.length) % searchHits.length;
      setSearchIdx(i);
      revealNode(searchHits[i]);
    },
    [searchHits, searchIdx, revealNode]
  );

  // ───────── Keyboard navigation ─────────
  const navigate = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      const L = layoutRef.current;
      const d = dataRef.current;
      const cur = selectedId ? L.boxes[selectedId] : null;
      if (!cur) {
        setSelectedId(d.rootId);
        return;
      }
      const node = d.nodes[cur.id];
      // Tree-aware moves first: into children / back to parent.
      const horizontal = layoutMode !== "org";
      const towardChildren = horizontal
        ? (dir === "right" && (cur.side === "right" || cur.depth === 0)) ||
          (dir === "left" && (cur.side === "left" || cur.depth === 0))
        : dir === "down";
      const towardParent = horizontal
        ? cur.depth > 0 && ((dir === "left" && cur.side === "right") || (dir === "right" && cur.side === "left"))
        : dir === "up";
      if (towardParent && node.parentId) {
        setSelectedId(node.parentId);
        return;
      }
      if (towardChildren && node.collapsed && node.children.length) {
        commit(M.toggleCollapse(d, node.id));
        return;
      }
      if (towardChildren && cur.depth > 0 && node.children.length) {
        const mid = node.children[Math.floor((node.children.length - 1) / 2)];
        setSelectedId(mid);
        return;
      }
      // Otherwise spatial: nearest box in that direction.
      const cx = cur.x + cur.w / 2;
      const cy = cur.y + cur.h / 2;
      let best: string | null = null;
      let bestScore = Infinity;
      for (const id of L.order) {
        if (id === cur.id) continue;
        const b = L.boxes[id];
        const bx = b.x + b.w / 2;
        const by = b.y + b.h / 2;
        const dx = bx - cx;
        const dy = by - cy;
        let primary: number, secondary: number;
        if (dir === "up") [primary, secondary] = [-dy, Math.abs(dx)];
        else if (dir === "down") [primary, secondary] = [dy, Math.abs(dx)];
        else if (dir === "left") [primary, secondary] = [-dx, Math.abs(dy)];
        else [primary, secondary] = [dx, Math.abs(dy)];
        if (primary <= 2) continue;
        const score = primary + secondary * 2.5;
        if (score < bestScore) {
          bestScore = score;
          best = id;
        }
      }
      if (best) setSelectedId(best);
    },
    [selectedId, layoutMode, commit]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog) return;
      if (editingId) return; // textarea handles its own keys
      const mod = e.metaKey || e.ctrlKey;
      const typing = isTypingTarget(e.target);
      if (typing) {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      const key = e.key;

      if (mod && key.toLowerCase() === "f") {
        e.preventDefault();
        setSearch((s) => s ?? "");
        setTimeout(() => document.getElementById("mm-search")?.focus(), 0);
        return;
      }
      if (mod && (key === "=" || key === "+")) {
        e.preventDefault();
        zoomAt(1.2);
        return;
      }
      if (mod && key === "-") {
        e.preventDefault();
        zoomAt(1 / 1.2);
        return;
      }
      if (mod && key === "0") {
        e.preventDefault();
        fitToScreen(1.5);
        return;
      }
      if (mod && key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (key === "?" || (key === "/" && e.shiftKey)) {
        e.preventDefault();
        setDialog("shortcuts");
        return;
      }
      if (key === "Escape") {
        setMenu(null);
        if (search !== null) setSearch(null);
        else setSelectedId(null);
        return;
      }
      if (!selectedId) {
        if (key.startsWith("Arrow") || key === "Enter" || key === "Tab") {
          e.preventDefault();
          setSelectedId(dataRef.current.rootId);
        }
        return;
      }
      if (key.startsWith("Arrow")) {
        e.preventDefault();
        if (mod && !readOnly && (key === "ArrowUp" || key === "ArrowDown")) {
          commit(M.shiftNode(dataRef.current, selectedId, key === "ArrowUp" ? -1 : 1));
          return;
        }
        navigate(key.slice(5).toLowerCase() as "up" | "down" | "left" | "right");
        return;
      }
      if (mod && key.toLowerCase() === "c") {
        e.preventDefault();
        copySelected(false);
        return;
      }
      if (readOnly) return;
      if (mod && key.toLowerCase() === "x") {
        e.preventDefault();
        copySelected(true);
        return;
      }
      if (mod && key.toLowerCase() === "d") {
        e.preventDefault();
        const d = dataRef.current;
        const n = d.nodes[selectedId];
        if (!n.parentId) return;
        const idx = d.nodes[n.parentId].children.indexOf(selectedId);
        const res = M.pasteSubtree(d, n.parentId, M.extractSubtree(d, selectedId), idx + 1);
        commit(res.data);
        setSelectedId(res.id);
        return;
      }
      if (mod && key.toLowerCase() === "b") {
        e.preventDefault();
        const s = dataRef.current.nodes[selectedId].style ?? {};
        patchSelected({ style: { ...s, bold: s.bold ? undefined : true } });
        return;
      }
      if (mod && key.toLowerCase() === "i") {
        e.preventDefault();
        const s = dataRef.current.nodes[selectedId].style ?? {};
        patchSelected({ style: { ...s, italic: s.italic ? undefined : true } });
        return;
      }
      if (key === "Tab") {
        e.preventDefault();
        addAndEdit(e.shiftKey ? "parent" : "child");
        return;
      }
      if (key === "Enter") {
        e.preventDefault();
        addAndEdit(e.shiftKey ? "siblingBefore" : "sibling");
        return;
      }
      if (key === "Delete" || key === "Backspace") {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (key === "F2") {
        e.preventDefault();
        startEdit(selectedId);
        return;
      }
      if (key === " ") {
        e.preventDefault();
        commit(M.toggleCollapse(dataRef.current, selectedId));
        return;
      }
      if (!mod && !e.altKey && key.length === 1) {
        // Start typing to replace the topic text.
        e.preventDefault();
        startEdit(selectedId, key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    dialog, editingId, selectedId, readOnly, search, navigate, undo, redo, zoomAt, fitToScreen,
    addAndEdit, deleteSelected, startEdit, commit, copySelected, patchSelected,
  ]);

  const onEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        finishEdit({ cancel: true });
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        finishEdit();
      } else if (e.key === "Tab") {
        e.preventDefault();
        const id = finishEdit();
        if (id) addAndEdit(e.shiftKey ? "parent" : "child", id);
      }
    },
    [finishEdit, addAndEdit]
  );

  // ───────── Pointer: pan, select, drag topics ─────────
  const panRef = useRef<{ pointerId: number; x: number; y: number; vx: number; vy: number; moved: boolean; fromNode: boolean } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.scale, y: (clientY - rect.top - v.y) / v.scale };
  }, []);

  const onCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    setMenu(null);
    if (editingId) finishEdit();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const v = viewRef.current;
    panRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, vx: v.x, vy: v.y, moved: false, fromNode: false };
  }, [editingId, finishEdit]);

  const onNodePointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      setMenu(null);
      if (editingId === id) return;
      if (editingId) finishEdit();
      setSelectedId(id);
      const d = dataRef.current;
      const isRoot = id === d.rootId;
      const container = containerRef.current!;
      container.setPointerCapture(e.pointerId);
      if (isRoot || readOnly) {
        // Dragging the central topic pans the whole map.
        const v = viewRef.current;
        panRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, vx: v.x, vy: v.y, moved: false, fromNode: true };
        return;
      }
      const w = toWorld(e.clientX, e.clientY);
      const b = layoutRef.current.boxes[id];
      setDrag({
        id,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        worldX: w.x,
        worldY: w.y,
        offX: w.x - b.x,
        offY: w.y - b.y,
        active: false,
        target: null,
      });
    },
    [editingId, finishEdit, readOnly, toWorld]
  );

  const computeDropTarget = useCallback(
    (dragId: string, wx: number, wy: number): DropTarget | null => {
      const L = layoutRef.current;
      const d = dataRef.current;
      const excluded = new Set(M.collectSubtree(d, dragId));
      const candidates = L.order.filter((id) => !excluded.has(id));

      // 1. Directly over a topic → become its child.
      for (const id of candidates) {
        const b = L.boxes[id];
        const insetY = id === d.rootId ? 0 : Math.min(8, b.h * 0.25);
        if (wx >= b.x && wx <= b.x + b.w && wy >= b.y + insetY && wy <= b.y + b.h - insetY) {
          const side: Side | undefined = id === d.rootId ? (wx < b.x + b.w / 2 ? "left" : "right") : undefined;
          return { parentId: id, index: d.nodes[id].children.length, side, mode: "into", refId: id };
        }
      }

      // 2. Near a non-root topic → insert before/after it as a sibling.
      let best: { id: string; dist: number } | null = null;
      for (const id of candidates) {
        if (id === d.rootId) continue;
        const b = L.boxes[id];
        const dx = wx < b.x ? b.x - wx : wx > b.x + b.w ? wx - (b.x + b.w) : 0;
        const dy = wy < b.y ? b.y - wy : wy > b.y + b.h ? wy - (b.y + b.h) : 0;
        if (layoutMode === "org" ? dy > 30 || dx > 60 : dx > 40 || dy > 30) continue;
        const dist = dx * 1.5 + dy;
        if (!best || dist < best.dist) best = { id, dist };
      }
      if (best) {
        const b = L.boxes[best.id];
        const n = d.nodes[best.id];
        const parent = d.nodes[n.parentId!];
        const idx = parent.children.indexOf(best.id);
        const before = layoutMode === "org" ? wx < b.x + b.w / 2 : wy < b.y + b.h / 2;
        return {
          parentId: parent.id,
          index: before ? idx : idx + 1,
          side: parent.id === d.rootId ? n.side : undefined,
          mode: before ? "before" : "after",
          refId: best.id,
        };
      }

      // 3. Empty space in mind-map mode → attach to the root on that side.
      if (layoutMode === "mindmap") {
        const rb = L.boxes[d.rootId];
        const side: Side = wx < rb.x + rb.w / 2 ? "left" : "right";
        return { parentId: d.rootId, index: d.nodes[d.rootId].children.length, side, mode: "into", refId: d.rootId };
      }
      return null;
    },
    [layoutMode]
  );

  const onContainerPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pan = panRef.current;
      if (pan && pan.pointerId === e.pointerId) {
        const dx = e.clientX - pan.x;
        const dy = e.clientY - pan.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) pan.moved = true;
        setView((v) => ({ ...v, x: pan.vx + dx, y: pan.vy + dy }));
        return;
      }
      const dg = dragRef.current;
      if (dg && dg.pointerId === e.pointerId) {
        const moved = Math.abs(e.clientX - dg.startX) + Math.abs(e.clientY - dg.startY);
        if (!dg.active && moved < 5) return;
        const w = toWorld(e.clientX, e.clientY);
        setDrag({ ...dg, active: true, worldX: w.x, worldY: w.y, target: computeDropTarget(dg.id, w.x, w.y) });
      }
    },
    [toWorld, computeDropTarget]
  );

  const onContainerPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const pan = panRef.current;
      if (pan && pan.pointerId === e.pointerId) {
        panRef.current = null;
        // A click on empty canvas (no movement) clears the selection.
        if (!pan.moved && !pan.fromNode) setSelectedId(null);
        return;
      }
      const dg = dragRef.current;
      if (dg && dg.pointerId === e.pointerId) {
        setDrag(null);
        if (dg.active && dg.target) {
          const t = dg.target;
          const next = M.moveNode(dataRef.current, dg.id, t.parentId, t.index, t.side);
          commit(next);
        }
      }
    },
    [commit]
  );

  // Wheel: pan, or zoom with Ctrl/⌘ (also trackpad pinch).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX - rect.left, e.clientY - rect.top);
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // ───────── Stable node callbacks ─────────
  const onDoubleClick = useCallback((id: string) => startEdit(id), [startEdit]);
  const onToggleCollapse = useCallback(
    (id: string) => {
      const d = dataRef.current;
      if (readOnly) {
        // Viewers can still fold branches locally (not saved).
        const next = M.toggleCollapse(d, id);
        dataRef.current = next;
        setData(next);
      } else commit(M.toggleCollapse(d, id));
    },
    [commit, readOnly]
  );
  const onAddChild = useCallback((id: string) => addAndEdit("child", id), [addAndEdit]);
  const onToggleTask = useCallback(
    (id: string) => {
      if (readOnly) return;
      const n = dataRef.current.nodes[id];
      if (!n.task) return;
      const done = !n.task.done;
      commit(M.updateNode(dataRef.current, id, { task: { ...n.task, done, progress: done ? 100 : n.task.progress === 100 ? 0 : n.task.progress } }));
    },
    [commit, readOnly]
  );
  const onOpenNote = useCallback((id: string) => {
    setSelectedId(id);
    setShowInspector(true);
    setInspectorTab("note");
  }, []);
  const onEditBlur = useCallback(() => {
    finishEdit();
  }, [finishEdit]);

  // ───────── Import ─────────
  const handleImport = useCallback(
    (text: string): string | null => {
      const trimmed = text.trim();
      if (!trimmed) return "Nothing to import";
      let next: MindMapData | null = null;
      if (trimmed.startsWith("{")) {
        try {
          const obj = JSON.parse(trimmed);
          next = M.sanitizeMap(obj.data ?? obj);
          if (next && obj.theme) setThemeId(String(obj.theme));
          if (next && obj.layout && LAYOUTS.some((l) => l.id === obj.layout)) setLayoutMode(obj.layout);
        } catch {
          return "That JSON could not be read";
        }
      } else {
        next = M.fromOutline(trimmed);
      }
      if (!next) return "Could not find any topics";
      commit(next);
      setSelectedId(next.rootId);
      setTimeout(() => fitToScreen(1), 30);
      return null;
    },
    [commit, fitToScreen]
  );

  // ───────── Live updates from collaborators ─────────
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;
  useEffect(() => {
    const hasCollaborators = (mapMeta.collaborators?.length ?? 0) > 0 || mapMeta.role !== "owner";
    if (!hasCollaborators) return;
    const tick = async () => {
      if (document.hidden || saveStateRef.current !== "saved" || editingIdRef.current || dragRef.current) return;
      try {
        const v = await fetch(`/api/maps/${initial.id}?versionOnly=1`).then((r) => r.json());
        if (typeof v.version !== "number" || v.version <= versionRef.current) return;
        const m = await fetch(`/api/maps/${initial.id}`).then((r) => r.json());
        const fresh = M.sanitizeMap(m.data);
        // Re-check: the user may have started editing while we were fetching.
        if (!fresh || saveStateRef.current !== "saved" || editingIdRef.current) return;
        versionRef.current = m.version;
        lastSaved.current = { data: fresh, title: m.title, themeId: m.theme, layoutMode: m.layout };
        past.current = [];
        future.current = [];
        dataRef.current = fresh;
        setData(fresh);
        setTitle(m.title);
        setThemeId(m.theme);
        setLayoutMode(m.layout);
        setSelectedId((id) => (id && fresh.nodes[id] ? id : null));
        showToast("Updated with a collaborator's changes");
      } catch {
        /* offline – try again next tick */
      }
    };
    const t = setInterval(tick, 4000);
    return () => clearInterval(t);
  }, [initial.id, mapMeta.collaborators, mapMeta.role, showToast]);

  // ───────── Derived ─────────
  const selectedNode = selectedId ? data.nodes[selectedId] ?? null : null;
  const dragTarget = drag?.active ? drag.target : null;
  const dragged = drag?.active ? new Set(M.collectSubtree(data, drag.id)) : null;

  const dropIndicator = useMemo(() => {
    if (!dragTarget || dragTarget.mode === "into") return null;
    const b = layout.boxes[dragTarget.refId];
    if (!b) return null;
    if (layoutMode === "org") {
      const x = dragTarget.mode === "before" ? b.x - 10 : b.x + b.w + 6;
      return { x, y: b.y, w: 4, h: b.h };
    }
    const y = dragTarget.mode === "before" ? b.y - 8 : b.y + b.h + 4;
    return { x: b.x, y, w: b.w, h: 4 };
  }, [dragTarget, layout, layoutMode]);

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;
  const zoomPct = Math.round(view.scale * 100);

  return (
    <div className="h-screen w-screen flex flex-col bg-white text-slate-800 overflow-hidden">
      {/* ───────── Toolbar ───────── */}
      <header className="h-14 shrink-0 flex items-center gap-1 px-2 border-b border-slate-200 bg-white z-20">
        <Link href="/maps" className="p-2 rounded-md hover:bg-slate-100 text-slate-600" title="All maps">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <input
          value={title}
          onChange={(e) => {
            titleLinked.current = false;
            setTitle(e.target.value);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          readOnly={readOnly}
          className="w-56 min-w-0 px-2 py-1.5 rounded-md text-[15px] font-semibold hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 truncate"
          aria-label="Map title"
        />
        <SaveBadge state={readOnly ? "readonly" : saveState} onRetry={() => void save()} />

        <Divider />
        <ToolButton title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo || readOnly}>
          <Undo2 className="w-4 h-4" />
        </ToolButton>
        <ToolButton title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo || readOnly}>
          <Redo2 className="w-4 h-4" />
        </ToolButton>
        <Divider />
        <ToolButton title="Add subtopic (Tab)" onClick={() => addAndEdit("child")} disabled={readOnly} label="Subtopic">
          <CornerDownRight className="w-4 h-4" />
        </ToolButton>
        <ToolButton
          title="Add topic (Enter)"
          onClick={() => addAndEdit("sibling")}
          disabled={readOnly || !selectedId}
          label="Topic"
        >
          <Plus className="w-4 h-4" />
        </ToolButton>
        <ToolButton
          title="Delete (Del)"
          onClick={deleteSelected}
          disabled={readOnly || !selectedNode?.parentId}
        >
          <Trash2 className="w-4 h-4" />
        </ToolButton>
        <Divider />
        <ToolButton title="Collapse all" onClick={() => commit(M.setCollapseAll(dataRef.current, true, 1))} disabled={readOnly}>
          <ChevronsDownUp className="w-4 h-4" />
        </ToolButton>
        <ToolButton title="Expand all" onClick={() => commit(M.setCollapseAll(dataRef.current, false))} disabled={readOnly}>
          <ChevronsUpDown className="w-4 h-4" />
        </ToolButton>

        <div className="relative">
          <ToolButton title="Layout" onClick={() => setMenu(menu === "layout" ? null : "layout")} disabled={readOnly} label={LAYOUTS.find((l) => l.id === layoutMode)?.label}>
            <LayoutIcon mode={layoutMode} />
          </ToolButton>
          {menu === "layout" && (
            <Menu>
              {LAYOUTS.map((l) => (
                <MenuItem
                  key={l.id}
                  active={l.id === layoutMode}
                  onClick={() => {
                    setLayoutMode(l.id);
                    setMenu(null);
                    setTimeout(() => fitToScreen(1), 30);
                  }}
                >
                  <LayoutIcon mode={l.id} />
                  <span className="flex-1">{l.label}</span>
                </MenuItem>
              ))}
              <div className="border-t border-slate-100 my-1" />
              <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Theme</div>
              {THEMES.map((t) => (
                <MenuItem
                  key={t.id}
                  active={t.id === themeId}
                  onClick={() => {
                    setThemeId(t.id);
                    setMenu(null);
                  }}
                >
                  <span className="flex gap-0.5">
                    {t.palette.slice(0, 3).map((c) => (
                      <span key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="flex-1">{t.name}</span>
                </MenuItem>
              ))}
            </Menu>
          )}
        </div>

        <div className="flex-1" />

        {search !== null ? (
          <div className="flex items-center gap-1 border border-slate-200 rounded-md px-2 h-9 mr-1">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              id="mm-search"
              autoFocus
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchIdx(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  gotoHit(e.shiftKey ? -1 : searchHits.length && searchHits[searchIdx] === selectedId ? 1 : 0);
                }
                if (e.key === "Escape") setSearch(null);
              }}
              placeholder="Search topics"
              className="w-40 text-sm outline-none"
            />
            <span className="text-xs text-slate-400 tabular-nums w-10 text-right">
              {search ? `${searchHits.length ? searchIdx + 1 : 0}/${searchHits.length}` : ""}
            </span>
          </div>
        ) : (
          <ToolButton
            title="Search (Ctrl+F)"
            onClick={() => {
              setSearch("");
              setTimeout(() => document.getElementById("mm-search")?.focus(), 0);
            }}
          >
            <Search className="w-4 h-4" />
          </ToolButton>
        )}

        <ToolButton title="Import" onClick={() => setDialog("import")} disabled={readOnly}>
          <Upload className="w-4 h-4" />
        </ToolButton>
        <div className="relative">
          <ToolButton title="Export" onClick={() => setMenu(menu === "export" ? null : "export")} label="Export">
            <Download className="w-4 h-4" />
          </ToolButton>
          {menu === "export" && (
            <Menu align="right">
              <MenuItem onClick={() => { setMenu(null); void exportPNG(layout, data, theme, title); }}>PNG image</MenuItem>
              <MenuItem onClick={() => { setMenu(null); exportSVG(layout, data, theme, title); }}>SVG vector</MenuItem>
              <MenuItem onClick={() => { setMenu(null); exportMarkdown(data, title); }}>Markdown outline</MenuItem>
              <MenuItem onClick={() => { setMenu(null); exportText(data, title); }}>Plain text outline</MenuItem>
              <MenuItem onClick={() => { setMenu(null); exportJSON(data, title, themeId, layoutMode); }}>Mind map file (.json)</MenuItem>
            </Menu>
          )}
        </div>
        <button
          onClick={() => setDialog("share")}
          className="ml-1 flex items-center gap-1.5 h-9 px-3 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          <Share2 className="w-4 h-4" /> Share
        </button>
        <Divider />
        <ToolButton title="Outline view" onClick={() => setShowOutline((s) => !s)} active={showOutline}>
          <ListTree className="w-4 h-4" />
        </ToolButton>
        <ToolButton title="Topic panel" onClick={() => setShowInspector((s) => !s)} active={showInspector}>
          <PanelRight className="w-4 h-4" />
        </ToolButton>
      </header>

      {saveState === "conflict" && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-sm">
          <AlertTriangle className="w-4 h-4" />
          Someone else saved changes to this map. Your latest edits were not saved.
          <button onClick={() => window.location.reload()} className="font-semibold underline">
            Reload map
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {showOutline && (
          <OutlinePanel
            data={data}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              requestAnimationFrame(() => centerOn(id, false));
            }}
            onToggle={onToggleCollapse}
            onClose={() => setShowOutline(false)}
          />
        )}

        {/* ───────── Canvas ───────── */}
        <div
          ref={containerRef}
          className={cn("relative flex-1 overflow-hidden touch-none", drag?.active ? "cursor-grabbing" : "cursor-grab")}
          style={{
            backgroundColor: theme.canvas,
            backgroundImage: `radial-gradient(${theme.dots} 1.2px, transparent 1.2px)`,
            backgroundSize: `${24 * view.scale}px ${24 * view.scale}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onContainerPointerMove}
          onPointerUp={onContainerPointerUp}
          onPointerCancel={onContainerPointerUp}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              transformOrigin: "0 0",
            }}
          >
            <svg className="absolute left-0 top-0 overflow-visible pointer-events-none" width="1" height="1">
              {layout.edges.map((edge) => (
                <path
                  key={edge.to}
                  d={edge.d}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth={edge.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={dragged?.has(edge.to) ? 0.3 : 1}
                />
              ))}
              {dragTarget && drag && (
                <DragLink layout={layout} target={dragTarget} wx={drag.worldX} wy={drag.worldY} color={theme.selection} />
              )}
            </svg>

            {layout.order.map((id) => (
              <NodeView
                key={id}
                node={data.nodes[id]}
                box={layout.boxes[id]}
                theme={theme}
                selected={selectedId === id}
                isRoot={id === data.rootId}
                editing={editingId === id}
                draft={editingId === id ? draft : ""}
                dropInto={dragTarget?.mode === "into" && dragTarget.refId === id}
                searchHit={searchHitSet.has(id)}
                dimmed={!!dragged?.has(id)}
                readOnly={readOnly}
                onDraftChange={setDraft}
                onEditKeyDown={onEditKeyDown}
                onEditBlur={onEditBlur}
                onPointerDown={onNodePointerDown}
                onDoubleClick={onDoubleClick}
                onToggleCollapse={onToggleCollapse}
                onAddChild={onAddChild}
                onToggleTask={onToggleTask}
                onOpenNote={onOpenNote}
              />
            ))}

            {dropIndicator && (
              <div
                className="absolute rounded-full pointer-events-none"
                style={{ left: dropIndicator.x, top: dropIndicator.y, width: dropIndicator.w, height: dropIndicator.h, background: theme.selection }}
              />
            )}

            {drag?.active && <DragGhost box={layout.boxes[drag.id]} x={drag.worldX - drag.offX} y={drag.worldY - drag.offY} node={data.nodes[drag.id]} />}
          </div>

          {/* Zoom controls */}
          <div
            className="absolute right-4 bottom-4 flex items-center gap-0.5 bg-white rounded-lg shadow-md border border-slate-200 p-1"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ToolButton title="Zoom out (Ctrl+-)" onClick={() => zoomAt(1 / 1.2)}>
              <ZoomOut className="w-4 h-4" />
            </ToolButton>
            <button className="w-12 text-xs tabular-nums text-slate-600 hover:text-slate-900" onClick={() => setView((v) => ({ ...v, scale: 1 }))} title="Reset zoom">
              {zoomPct}%
            </button>
            <ToolButton title="Zoom in (Ctrl+=)" onClick={() => zoomAt(1.2)}>
              <ZoomIn className="w-4 h-4" />
            </ToolButton>
            <ToolButton title="Fit to screen (Ctrl+0)" onClick={() => fitToScreen(1.5)}>
              <Maximize className="w-4 h-4" />
            </ToolButton>
          </div>
          <div className="absolute left-4 bottom-4 flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={() => setDialog("shortcuts")}
              className="flex items-center gap-1.5 bg-white rounded-lg shadow-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              <Keyboard className="w-4 h-4" /> Shortcuts
            </button>
            <span className="text-xs text-slate-500 bg-white/80 rounded px-2 py-1">{M.countNodes(data)} topics</span>
          </div>

          {toast && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-6 bg-slate-900 text-white text-sm px-3 py-1.5 rounded-md shadow-lg">
              {toast}
            </div>
          )}
          {M.countNodes(data) === 1 && !editingId && !readOnly && (
            <div className="absolute left-1/2 -translate-x-1/2 top-6 bg-white/90 border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-lg shadow-sm pointer-events-none">
              Press <kbd className="px-1 border rounded">Tab</kbd> to add a subtopic, <kbd className="px-1 border rounded">Enter</kbd> for a sibling, or just start typing.
            </div>
          )}
        </div>

        {showInspector && (
          <Inspector
            node={selectedNode}
            isRoot={selectedId === data.rootId}
            readOnly={readOnly}
            tab={inspectorTab}
            onTab={setInspectorTab}
            onChange={patchSelected}
            onClose={() => setShowInspector(false)}
            themeId={themeId}
            layout={layoutMode}
            onTheme={setThemeId}
            onLayout={(l) => {
              setLayoutMode(l);
              setTimeout(() => fitToScreen(1), 30);
            }}
          />
        )}
      </div>

      {dialog === "share" && (
        <ShareDialog
          map={mapMeta}
          onClose={() => setDialog(null)}
          onChange={(collaborators) => setMapMeta((m) => ({ ...m, collaborators }))}
        />
      )}
      {dialog === "shortcuts" && <ShortcutsDialog onClose={() => setDialog(null)} />}
      {dialog === "import" && <ImportDialog onClose={() => setDialog(null)} onImport={handleImport} />}
    </div>
  );
}

// ───────── Small presentational helpers ─────────

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
}

function Divider() {
  return <div className="w-px h-6 bg-slate-200 mx-1" />;
}

function ToolButton({
  children,
  title,
  onClick,
  disabled,
  active,
  label,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 h-9 px-2 rounded-md text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 disabled:pointer-events-none transition",
        active && "bg-indigo-50 text-indigo-600"
      )}
    >
      {children}
      {label && <span className="hidden xl:inline whitespace-nowrap">{label}</span>}
    </button>
  );
}

function Menu({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <div
      className={cn(
        "absolute top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-30",
        align === "right" ? "right-0" : "left-0"
      )}
    >
      {children}
    </div>
  );
}

function MenuItem({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-slate-50", active && "text-indigo-600 font-medium")}
    >
      {children}
      {active && <Check className="w-4 h-4 ml-auto" />}
    </button>
  );
}

function LayoutIcon({ mode }: { mode: LayoutMode }) {
  const paths: Record<LayoutMode, string> = {
    mindmap: "M8 10h4M4 5c2 0 2 5 4 5M4 15c2 0 2-5 4-5M16 5c-2 0-2 5-4 5M16 15c-2 0-2-5-4-5",
    right: "M3 10h4M7 10c2 0 2-5 4-5h5M7 10c2 0 2 5 4 5h5M7 10h9",
    left: "M17 10h-4M13 10c-2 0-2-5-4-5H4M13 10c-2 0-2 5-4 5H4M13 10H4",
    org: "M10 3v4M10 7c0 2-6 2-6 4v3M10 7c0 2 6 2 6 4v3M10 7v7",
  };
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d={paths[mode]} />
    </svg>
  );
}

function SaveBadge({ state, onRetry }: { state: SaveState | "readonly"; onRetry: () => void }) {
  if (state === "readonly")
    return (
      <span className="flex items-center gap-1 text-xs text-slate-500 px-2">
        <Eye className="w-3.5 h-3.5" /> View only
      </span>
    );
  if (state === "saving" || state === "dirty")
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400 px-2 w-20">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving
      </span>
    );
  if (state === "error")
    return (
      <button onClick={onRetry} className="flex items-center gap-1 text-xs text-red-600 px-2 hover:underline">
        <AlertTriangle className="w-3.5 h-3.5" /> Not saved · retry
      </button>
    );
  if (state === "conflict")
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600 px-2">
        <AlertTriangle className="w-3.5 h-3.5" /> Conflict
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-slate-400 px-2 w-20">
      <Check className="w-3.5 h-3.5" /> Saved
    </span>
  );
}

function DragGhost({ box, x, y, node }: { box: NodeBox; x: number; y: number; node: MindNode }) {
  if (!box) return null;
  return (
    <div
      className="absolute pointer-events-none rounded-lg shadow-xl px-3 flex items-center text-sm font-medium"
      style={{
        left: x,
        top: y,
        minWidth: Math.min(box.w, 220),
        height: Math.max(32, Math.min(box.h, 48)),
        background: "#fff",
        border: `2px solid ${box.color}`,
        color: "#1f2937",
        opacity: 0.92,
      }}
    >
      <span className="truncate max-w-[220px]">{node.icon ? node.icon + " " : ""}{node.text || "Topic"}</span>
    </div>
  );
}

function DragLink({
  layout,
  target,
  wx,
  wy,
  color,
}: {
  layout: LayoutResult;
  target: DropTarget;
  wx: number;
  wy: number;
  color: string;
}) {
  const p = layout.boxes[target.parentId];
  if (!p) return null;
  const sx = target.side === "left" ? p.x : p.x + p.w;
  const sy = p.y + p.h / 2;
  return (
    <path
      d={`M ${sx} ${sy} C ${(sx + wx) / 2} ${sy}, ${(sx + wx) / 2} ${wy}, ${wx} ${wy}`}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeDasharray="6 5"
    />
  );
}
