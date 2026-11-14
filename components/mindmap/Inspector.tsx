"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Palette,
  Smile,
  StickyNote,
  CheckSquare,
  Link2,
  Image as ImageIcon,
  X,
} from "lucide-react";
import type { LayoutMode, MindNode, NodeShape, NodeStyle, NodeTask } from "@/lib/mindmap/types";
import { COLOR_SWATCHES, ICON_GROUPS, THEMES } from "@/lib/mindmap/themes";
import { cn } from "@/lib/utils";

export type InspectorTab = "style" | "icon" | "note" | "task" | "link";

interface Props {
  node: MindNode | null;
  isRoot: boolean;
  readOnly: boolean;
  tab: InspectorTab;
  onTab: (t: InspectorTab) => void;
  onChange: (patch: Partial<MindNode>, coalesceKey?: string) => void;
  onClose: () => void;
  themeId: string;
  layout: LayoutMode;
  onTheme: (id: string) => void;
  onLayout: (l: LayoutMode) => void;
}

const TABS: { id: InspectorTab; label: string; icon: typeof Palette }[] = [
  { id: "style", label: "Style", icon: Palette },
  { id: "icon", label: "Icon", icon: Smile },
  { id: "note", label: "Note", icon: StickyNote },
  { id: "task", label: "Task", icon: CheckSquare },
  { id: "link", label: "Link", icon: Link2 },
];

const SHAPES: { id: NodeShape; label: string }[] = [
  { id: "rounded", label: "Rounded" },
  { id: "pill", label: "Pill" },
  { id: "rect", label: "Box" },
  { id: "underline", label: "Line" },
  { id: "none", label: "Text" },
];

export const LAYOUTS: { id: LayoutMode; label: string; hint: string }[] = [
  { id: "mindmap", label: "Mind map", hint: "Branches on both sides" },
  { id: "right", label: "Right", hint: "All branches to the right" },
  { id: "left", label: "Left", hint: "All branches to the left" },
  { id: "org", label: "Org chart", hint: "Top-down hierarchy" },
];

export function Inspector(p: Props) {
  const { node } = p;

  return (
    <aside
      className="w-[300px] shrink-0 border-l border-slate-200 bg-white text-slate-800 flex flex-col"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 h-11 border-b border-slate-200">
        <span className="text-sm font-semibold">{node ? "Topic" : "Map settings"}</span>
        <button onClick={p.onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" title="Close panel">
          <X className="w-4 h-4" />
        </button>
      </div>

      {node ? (
        <>
          <div className="flex border-b border-slate-200">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => p.onTab(id)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition border-b-2",
                  p.tab === id
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          <div className={cn("flex-1 overflow-y-auto p-4", p.readOnly && "pointer-events-none opacity-60")}>
            {p.tab === "style" && <StyleTab node={node} isRoot={p.isRoot} onChange={p.onChange} />}
            {p.tab === "icon" && <IconTab node={node} onChange={p.onChange} />}
            {p.tab === "note" && <NoteTab node={node} onChange={p.onChange} />}
            {p.tab === "task" && <TaskTab node={node} onChange={p.onChange} />}
            {p.tab === "link" && <LinkTab node={node} onChange={p.onChange} />}
          </div>
        </>
      ) : (
        <MapSettings {...p} />
      )}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h4 className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-2">{title}</h4>
      {children}
    </div>
  );
}

function StyleTab({
  node,
  isRoot,
  onChange,
}: {
  node: MindNode;
  isRoot: boolean;
  onChange: Props["onChange"];
}) {
  const s = node.style ?? {};
  const set = (patch: Partial<NodeStyle>) => {
    const next: NodeStyle = { ...s, ...patch };
    (Object.keys(next) as (keyof NodeStyle)[]).forEach((k) => next[k] === undefined && delete next[k]);
    onChange({ style: Object.keys(next).length ? next : undefined });
  };
  return (
    <>
      <Section title="Color">
        <div className="grid grid-cols-6 gap-2">
          <button
            onClick={() => set({ color: undefined })}
            className={cn(
              "h-8 rounded-md border-2 text-[10px] text-slate-500 bg-[repeating-linear-gradient(45deg,#fff,#fff_4px,#f1f3f5_4px,#f1f3f5_8px)]",
              !s.color ? "border-indigo-500" : "border-slate-200"
            )}
            title="Automatic"
          >
            Auto
          </button>
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => set({ color: c })}
              className={cn("h-8 rounded-md border-2 transition hover:scale-105", s.color === c ? "border-slate-900" : "border-transparent")}
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 mt-2 text-xs text-slate-500">
          Custom
          <input
            type="color"
            value={s.color ?? "#4263eb"}
            onChange={(e) => onChange({ style: { ...s, color: e.target.value } }, "color")}
            className="h-7 w-10 rounded border border-slate-200 cursor-pointer"
          />
        </label>
      </Section>

      <Section title="Text">
        <div className="flex gap-2">
          <button
            onClick={() => set({ bold: s.bold ? undefined : true })}
            className={cn("p-2 rounded-md border", s.bold ? "bg-indigo-50 border-indigo-400 text-indigo-600" : "border-slate-200 hover:bg-slate-50")}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => set({ italic: s.italic ? undefined : true })}
            className={cn("p-2 rounded-md border", s.italic ? "bg-indigo-50 border-indigo-400 text-indigo-600" : "border-slate-200 hover:bg-slate-50")}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <select
            value={String(s.fontScale ?? 1)}
            onChange={(e) => set({ fontScale: e.target.value === "1" ? undefined : Number(e.target.value) })}
            className="flex-1 border border-slate-200 rounded-md px-2 text-sm bg-white"
          >
            <option value="0.85">Small</option>
            <option value="1">Normal</option>
            <option value="1.25">Large</option>
            <option value="1.5">Extra large</option>
          </select>
        </div>
        <label className="flex items-center gap-2 mt-2 text-xs text-slate-500">
          Text color
          <input
            type="color"
            value={s.textColor ?? "#1f2937"}
            onChange={(e) => onChange({ style: { ...s, textColor: e.target.value } }, "textColor")}
            className="h-7 w-10 rounded border border-slate-200 cursor-pointer"
          />
          {s.textColor && (
            <button className="underline" onClick={() => set({ textColor: undefined })}>
              reset
            </button>
          )}
        </label>
      </Section>

      {!isRoot && (
        <Section title="Shape">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => set({ shape: undefined })}
              className={cn("py-1.5 text-xs rounded-md border", !s.shape ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:bg-slate-50")}
            >
              Theme
            </button>
            {SHAPES.map((sh) => (
              <button
                key={sh.id}
                onClick={() => set({ shape: sh.id })}
                className={cn("py-1.5 text-xs rounded-md border", s.shape === sh.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:bg-slate-50")}
              >
                {sh.label}
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title="Image">
        <ImageField node={node} onChange={onChange} />
      </Section>
    </>
  );
}

function ImageField({ node, onChange }: { node: MindNode; onChange: Props["onChange"] }) {
  const [url, setUrl] = useState(node.image ?? "");
  useEffect(() => setUrl(node.image ?? ""), [node.id, node.image]);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => onChange({ image: url.trim() || undefined })}
          onKeyDown={(e) => e.key === "Enter" && onChange({ image: url.trim() || undefined })}
          placeholder="https://… image URL"
          className="flex-1 min-w-0 border border-slate-200 rounded-md px-2 py-1.5 text-sm"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="px-2 rounded-md border border-slate-200 hover:bg-slate-50"
          title="Upload image"
        >
          <ImageIcon className="w-4 h-4 text-slate-600" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            void downscaleImage(f).then((dataUrl) => onChange({ image: dataUrl }));
            e.target.value = "";
          }}
        />
      </div>
      {node.image && (
        <button className="text-xs text-red-600 hover:underline" onClick={() => onChange({ image: undefined })}>
          Remove image
        </button>
      )}
    </div>
  );
}

/** Keep stored maps small: shrink uploaded images to fit 320×200 as JPEG. */
async function downscaleImage(file: File): Promise<string> {
  const src = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = rej;
    img.src = src;
  });
  const scale = Math.min(1, 320 / img.width, 200 / img.height);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

function IconTab({ node, onChange }: { node: MindNode; onChange: Props["onChange"] }) {
  return (
    <>
      {node.icon && (
        <button
          onClick={() => onChange({ icon: undefined })}
          className="mb-4 w-full text-sm py-1.5 rounded-md border border-slate-200 hover:bg-slate-50"
        >
          Remove icon {node.icon}
        </button>
      )}
      {ICON_GROUPS.map((g) => (
        <Section key={g.label} title={g.label}>
          <div className="grid grid-cols-8 gap-1">
            {g.icons.map((ic) => (
              <button
                key={ic}
                onClick={() => onChange({ icon: node.icon === ic ? undefined : ic })}
                className={cn(
                  "h-8 rounded-md text-lg hover:bg-slate-100 transition",
                  node.icon === ic && "bg-indigo-100 ring-1 ring-indigo-400"
                )}
              >
                {ic}
              </button>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}

function NoteTab({ node, onChange }: { node: MindNode; onChange: Props["onChange"] }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [node.id]);
  return (
    <Section title="Note">
      <textarea
        ref={ref}
        value={node.note ?? ""}
        onChange={(e) => onChange({ note: e.target.value || undefined }, `note:${node.id}`)}
        placeholder="Add details, context or anything else…"
        className="w-full h-64 border border-slate-200 rounded-md p-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
      <p className="text-xs text-slate-400 mt-1">Notes appear as 📝 on the topic.</p>
    </Section>
  );
}

function TaskTab({ node, onChange }: { node: MindNode; onChange: Props["onChange"] }) {
  const t = node.task;
  const set = (patch: Partial<NodeTask>) => onChange({ task: { done: false, ...t, ...patch } });
  if (!t) {
    return (
      <div className="text-center py-8">
        <CheckSquare className="w-10 h-10 mx-auto text-slate-300 mb-3" />
        <p className="text-sm text-slate-600 mb-4">Turn this topic into a task to track progress.</p>
        <button
          onClick={() => onChange({ task: { done: false } })}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          Make it a task
        </button>
      </div>
    );
  }
  return (
    <>
      <Section title="Status">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={t.done} onChange={(e) => set({ done: e.target.checked, progress: e.target.checked ? 100 : t.progress === 100 ? 0 : t.progress })} className="w-4 h-4 accent-indigo-600" />
          Completed
        </label>
      </Section>
      <Section title={`Progress · ${t.progress ?? 0}%`}>
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={t.progress ?? 0}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange({ task: { ...t, progress: v, done: v === 100 } }, `progress:${node.id}`);
          }}
          className="w-full accent-indigo-600"
        />
      </Section>
      <Section title="Priority">
        <div className="flex gap-2">
          {([1, 2, 3] as const).map((pr) => (
            <button
              key={pr}
              onClick={() => set({ priority: t.priority === pr ? undefined : pr })}
              className={cn(
                "flex-1 py-1.5 text-sm rounded-md border",
                t.priority === pr ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:bg-slate-50"
              )}
            >
              {pr === 1 ? "High" : pr === 2 ? "Medium" : "Low"}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Due date">
        <input
          type="date"
          value={t.due ?? ""}
          onChange={(e) => set({ due: e.target.value || undefined })}
          className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm"
        />
      </Section>
      <button onClick={() => onChange({ task: undefined })} className="text-xs text-red-600 hover:underline">
        Remove task
      </button>
    </>
  );
}

function LinkTab({ node, onChange }: { node: MindNode; onChange: Props["onChange"] }) {
  const [url, setUrl] = useState(node.link ?? "");
  useEffect(() => setUrl(node.link ?? ""), [node.id, node.link]);
  const save = () => {
    let v = url.trim();
    if (v && !/^[a-z][a-z0-9+.-]*:/i.test(v)) v = "https://" + v;
    if (v && !/^(https?|mailto):/i.test(v)) return; // block javascript: etc.
    onChange({ link: v || undefined });
    setUrl(v);
  };
  return (
    <Section title="Web link">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="https://example.com"
        className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm"
      />
      {node.link && (
        <div className="flex items-center justify-between mt-2">
          <a href={node.link} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline truncate">
            Open link ↗
          </a>
          <button className="text-xs text-red-600 hover:underline" onClick={() => onChange({ link: undefined })}>
            Remove
          </button>
        </div>
      )}
    </Section>
  );
}

function MapSettings(p: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <Section title="Layout">
        <div className="grid grid-cols-2 gap-2">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              disabled={p.readOnly}
              onClick={() => p.onLayout(l.id)}
              className={cn(
                "p-2 rounded-md border text-left",
                p.layout === l.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
              )}
            >
              <div className="text-sm font-medium">{l.label}</div>
              <div className="text-[11px] text-slate-500">{l.hint}</div>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Theme">
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              disabled={p.readOnly}
              onClick={() => p.onTheme(t.id)}
              className={cn(
                "rounded-md border overflow-hidden text-left",
                p.themeId === t.id ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="h-12 flex items-center justify-center gap-1" style={{ background: t.canvas }}>
                <span className="w-6 h-3.5 rounded" style={{ background: t.rootBg, border: `1px solid ${t.rootText === "#ffffff" ? t.rootBg : "#111"}` }} />
                {t.palette.slice(0, 4).map((c) => (
                  <span key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
                ))}
              </div>
              <div className="px-2 py-1 text-xs font-medium">{t.name}</div>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Tip">
        <p className="text-xs text-slate-500 leading-relaxed">
          Select a topic to style it, add icons, notes, tasks, links and images. Press <kbd className="px-1 border rounded">?</kbd> for keyboard shortcuts.
        </p>
      </Section>
    </div>
  );
}
