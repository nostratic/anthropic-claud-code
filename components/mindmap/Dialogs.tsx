"use client";

import { useState } from "react";
import { X, Loader2, Trash2, UserPlus } from "lucide-react";
import type { MindMapRecord } from "@/lib/mindmap/types";

export function Modal({
  title,
  onClose,
  children,
  width = 480,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onPointerDown={onClose}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="bg-white text-slate-800 rounded-xl shadow-2xl w-full max-h-[85vh] flex flex-col"
        style={{ maxWidth: width }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-12 border-b border-slate-200 shrink-0">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

type Collab = NonNullable<MindMapRecord["collaborators"]>[number];

export function ShareDialog({
  map,
  onClose,
  onChange,
}: {
  map: MindMapRecord;
  onClose: () => void;
  onChange: (collabs: Collab[]) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const collabs = map.collaborators ?? [];
  const isOwner = map.role === "owner";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/maps/${map.id}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Could not share map");
      return;
    }
    onChange([...collabs.filter((c) => c.user.id !== body.user.id), body]);
    setEmail("");
  }

  async function remove(userId: string) {
    const res = await fetch(`/api/maps/${map.id}/collaborators`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) onChange(collabs.filter((c) => c.user.id !== userId));
  }

  return (
    <Modal title="Share map" onClose={onClose}>
      {isOwner ? (
        <form onSubmit={add} className="flex gap-2 mb-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Collaborator's email"
            className="flex-1 min-w-0 border border-slate-200 rounded-md px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
            className="border border-slate-200 rounded-md px-2 text-sm bg-white"
          >
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
          <button
            disabled={busy}
            className="flex items-center gap-1.5 px-3 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Invite
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate-500 mb-4">Only the owner can change who has access.</p>
      )}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <ul className="divide-y divide-slate-100">
        {map.owner && (
          <li className="flex items-center gap-3 py-2.5">
            <Avatar name={map.owner.name} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{map.owner.name}</p>
              <p className="text-xs text-slate-500 truncate">{map.owner.email}</p>
            </div>
            <span className="text-xs text-slate-500">Owner</span>
          </li>
        )}
        {collabs.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2.5">
            <Avatar name={c.user.name} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{c.user.name}</p>
              <p className="text-xs text-slate-500 truncate">{c.user.email}</p>
            </div>
            <span className="text-xs text-slate-500">{c.role === "viewer" ? "Can view" : "Can edit"}</span>
            {isOwner && (
              <button onClick={() => remove(c.user.id)} className="p-1 text-slate-400 hover:text-red-600" title="Remove access">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-400 mt-4">
        Collaborators need an account. Their edits are saved to the same map; if two people edit at once you will be asked to reload.
      </p>
    </Modal>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold shrink-0">
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Tab", "Add subtopic"],
  ["Enter", "Add topic below (sibling)"],
  ["Shift + Enter", "Add topic above"],
  ["Shift + Tab", "Insert parent topic"],
  ["F2 / double-click / type", "Edit topic text"],
  ["Shift + Enter (while editing)", "New line"],
  ["Esc", "Cancel editing / deselect"],
  ["Delete / Backspace", "Delete topic"],
  ["Arrow keys", "Navigate between topics"],
  ["Ctrl/⌘ + ↑ / ↓", "Move topic up / down"],
  ["Space", "Collapse / expand branch"],
  ["Ctrl/⌘ + Z", "Undo"],
  ["Ctrl/⌘ + Shift + Z / Ctrl + Y", "Redo"],
  ["Ctrl/⌘ + C / X / V", "Copy / cut / paste branch"],
  ["Ctrl/⌘ + D", "Duplicate branch"],
  ["Ctrl/⌘ + B / I", "Bold / italic"],
  ["Ctrl/⌘ + F", "Search topics"],
  ["Ctrl/⌘ + + / −", "Zoom in / out"],
  ["Ctrl/⌘ + 0", "Fit map to screen"],
  ["Drag topic", "Move / re-parent (drop on a topic, or between topics)"],
  ["Drag canvas / scroll", "Pan the map"],
  ["Ctrl/⌘ + scroll", "Zoom"],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} width={520}>
      <table className="w-full text-sm">
        <tbody>
          {SHORTCUTS.map(([k, v]) => (
            <tr key={k} className="border-b border-slate-100 last:border-0">
              <td className="py-1.5 pr-4 whitespace-nowrap">
                <kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-slate-50 text-xs font-mono">{k}</kbd>
              </td>
              <td className="py-1.5 text-slate-600">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

export function ImportDialog({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (text: string) => string | null;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  return (
    <Modal title="Import into this map" onClose={onClose} width={560}>
      <p className="text-sm text-slate-600 mb-3">
        Paste an indented outline (tabs, spaces, or Markdown bullets) or a <code>.mindmap.json</code> export. It replaces the
        current map — you can undo with Ctrl/⌘ + Z.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Project\n  Goals\n    Ship v1\n  Team\n  Risks"}
        className="w-full h-56 border border-slate-200 rounded-md p-2.5 text-sm font-mono"
      />
      <div className="flex items-center justify-between mt-3">
        <label className="text-sm text-indigo-600 hover:underline cursor-pointer">
          Choose file…
          <input
            type="file"
            accept=".json,.txt,.md,.markdown,text/plain,application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setText(await f.text());
            }}
          />
        </label>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-red-600">{error}</span>}
          <button
            onClick={() => {
              const err = onImport(text);
              if (err) setError(err);
              else onClose();
            }}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Import
          </button>
        </div>
      </div>
    </Modal>
  );
}
