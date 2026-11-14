"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  Search,
  MoreHorizontal,
  Copy,
  Trash2,
  Upload,
  Users,
  Network,
  LogOut,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import type { MindMapSummary } from "@/lib/mindmap/types";
import { TEMPLATES } from "@/lib/mindmap/templates";
import { getTheme } from "@/lib/mindmap/themes";
import { fromOutline, sanitizeMap } from "@/lib/mindmap/model";
import { formatRelativeTime } from "@/lib/utils";

export default function MapsPage() {
  const router = useRouter();
  const [maps, setMaps] = useState<MindMapSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    fetch("/api/maps")
      .then((r) => r.json())
      .then((m) => setMaps(Array.isArray(m) ? m : []));

  useEffect(() => {
    load();
    const close = () => setMenuFor(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  async function create(body: Record<string, unknown>, key: string) {
    setCreating(key);
    setError("");
    const res = await fetch("/api/maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setCreating(null);
      setError("Could not create map");
      return;
    }
    const { id } = await res.json();
    router.push(`/maps/${id}`);
  }

  async function importFile(file: File) {
    const text = await file.text();
    let payload: Record<string, unknown> | null = null;
    if (text.trim().startsWith("{")) {
      try {
        const obj = JSON.parse(text);
        const data = sanitizeMap(obj.data ?? obj);
        if (data) payload = { data, title: obj.title, theme: obj.theme, layout: obj.layout };
      } catch {
        /* fall through */
      }
    } else {
      const data = fromOutline(text);
      if (data) payload = { data };
    }
    if (!payload) {
      setError("That file doesn't look like a mind map or outline");
      return;
    }
    void create(payload, "import");
  }

  async function duplicate(id: string) {
    const res = await fetch(`/api/maps/${id}/duplicate`, { method: "POST" });
    if (res.ok) load();
  }

  async function remove(m: MindMapSummary) {
    const msg =
      m.role === "owner"
        ? `Delete "${m.title}"? This cannot be undone.`
        : `Leave "${m.title}"? You will lose access to it.`;
    if (!confirm(msg)) return;
    const res = await fetch(`/api/maps/${m.id}`, { method: "DELETE" });
    if (res.ok) setMaps((prev) => prev?.filter((x) => x.id !== m.id) ?? null);
  }

  const filtered = useMemo(
    () => (maps ?? []).filter((m) => m.title.toLowerCase().includes(query.toLowerCase())),
    [maps, query]
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mind Maps</h1>
            <p className="text-muted-foreground mt-1">Brainstorm, plan and organise ideas visually</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2.5 border border-border text-foreground rounded-lg hover:bg-secondary transition text-sm"
            >
              {creating === "import" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.txt,.md,.markdown"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => create({ template: "blank" }, "blank")}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition text-sm"
            >
              {creating === "blank" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              New Mind Map
            </button>
          </div>
        </div>
        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        {/* Templates */}
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Start from a template</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
          {TEMPLATES.map((t) => {
            const th = getTheme(t.theme);
            return (
              <button
                key={t.id}
                onClick={() => create({ template: t.id }, t.id)}
                disabled={!!creating}
                className="group text-left bg-card border border-border hover:border-primary/50 rounded-xl overflow-hidden transition disabled:opacity-60"
              >
                <div className="h-20 flex items-center justify-center relative" style={{ background: th.canvas }}>
                  {creating === t.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                  ) : (
                    <TemplatePreview layout={t.layout} colors={th.palette} root={th.rootBg} plus={t.id === "blank"} />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Maps */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="font-semibold text-foreground">My maps</h2>
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search maps"
              className="pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        {maps === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
            <Network className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium">{maps.length ? "No maps match your search" : "No mind maps yet"}</p>
            <p className="text-muted-foreground text-sm mt-1">Create a blank map or pick a template above.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((m) => {
              const th = getTheme(m.theme);
              return (
                <div
                  key={m.id}
                  className="group relative bg-card border border-border hover:border-primary/40 rounded-xl overflow-hidden transition cursor-pointer"
                  onClick={() => router.push(`/maps/${m.id}`)}
                >
                  <div className="h-28 flex items-center justify-center" style={{ background: th.canvas }}>
                    <TemplatePreview layout="mindmap" colors={th.palette} root={th.rootBg} />
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition truncate">{m.title}</h3>
                      <button
                        className="p-1 -mr-1 rounded hover:bg-secondary text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor(menuFor === m.id ? null : m.id);
                        }}
                        aria-label="Map actions"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                      {m.nodeCount} topics · {formatRelativeTime(m.updatedAt)}
                      {m.role !== "owner" && (
                        <span className="inline-flex items-center gap-1 ml-1 text-primary">
                          <Users className="w-3 h-3" /> {m.owner.name}
                        </span>
                      )}
                    </p>
                  </div>
                  {menuFor === m.id && (
                    <div
                      className="absolute right-3 top-[150px] w-40 bg-card border border-border rounded-lg shadow-xl py-1 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setMenuFor(null);
                          void duplicate(m.id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary"
                      >
                        <Copy className="w-4 h-4" /> Duplicate
                      </button>
                      <button
                        onClick={() => {
                          setMenuFor(null);
                          void remove(m);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-secondary"
                      >
                        {m.role === "owner" ? <Trash2 className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                        {m.role === "owner" ? "Delete" : "Leave"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function TemplatePreview({
  layout,
  colors,
  root,
  plus,
}: {
  layout: string;
  colors: string[];
  root: string;
  plus?: boolean;
}) {
  if (plus) {
    return (
      <svg width="120" height="60" viewBox="0 0 120 60">
        <rect x="40" y="20" width="40" height="20" rx="6" fill={root} stroke="#111" strokeOpacity={root === "#ffffff" ? 1 : 0} />
        <path d="M60 25v10M55 30h10" stroke={root === "#ffffff" ? "#111" : "#fff"} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  const c = (i: number) => colors[i % colors.length];
  if (layout === "org") {
    return (
      <svg width="120" height="60" viewBox="0 0 120 60">
        <path d="M60 16v8M60 24H25v10M60 24h35v10M60 24v10" stroke={c(0)} strokeWidth="2" fill="none" />
        <rect x="45" y="6" width="30" height="10" rx="3" fill={root} />
        {[10, 45, 80].map((x, i) => (
          <rect key={x} x={x} y="34" width="30" height="10" rx="3" fill={c(i)} />
        ))}
      </svg>
    );
  }
  const right = layout === "right";
  const branches = right
    ? [[90, 12], [90, 30], [90, 48]]
    : [[95, 15], [95, 45], [25, 15], [25, 45]];
  const cx = right ? 30 : 60;
  return (
    <svg width="120" height="60" viewBox="0 0 120 60">
      {branches.map(([x, y], i) => (
        <path key={i} d={`M${cx} 30 C ${(cx + x) / 2} 30, ${(cx + x) / 2} ${y}, ${x} ${y}`} stroke={c(i)} strokeWidth="2.5" fill="none" />
      ))}
      {branches.map(([x, y], i) => (
        <rect key={"r" + i} x={x - (x > cx ? 0 : 20)} y={y - 4} width="20" height="8" rx="4" fill={c(i)} />
      ))}
      <rect x={cx - 16} y="23" width="32" height="14" rx="5" fill={root} stroke="#111" strokeOpacity={root === "#ffffff" ? 0.8 : 0} />
    </svg>
  );
}
