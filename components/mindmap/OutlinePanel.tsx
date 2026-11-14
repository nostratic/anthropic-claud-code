"use client";

import { ChevronDown, ChevronRight, X } from "lucide-react";
import type { MindMapData } from "@/lib/mindmap/types";
import { cn } from "@/lib/utils";

export function OutlinePanel({
  data,
  selectedId,
  onSelect,
  onToggle,
  onClose,
}: {
  data: MindMapData;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const rows: { id: string; depth: number }[] = [];
  const walk = (id: string, depth: number) => {
    const n = data.nodes[id];
    if (!n) return;
    rows.push({ id, depth });
    if (n.collapsed && n.parentId) return;
    n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(data.rootId, 0);

  return (
    <aside className="w-[280px] shrink-0 border-r border-slate-200 bg-white text-slate-800 flex flex-col">
      <div className="flex items-center justify-between px-4 h-11 border-b border-slate-200">
        <span className="text-sm font-semibold">Outline</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" title="Close outline">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {rows.map(({ id, depth }) => {
          const n = data.nodes[id];
          const hasKids = n.children.length > 0 && depth > 0;
          return (
            <div
              key={id}
              onClick={() => onSelect(id)}
              className={cn(
                "flex items-center gap-1 pr-3 py-1 text-sm cursor-pointer hover:bg-slate-50",
                selectedId === id && "bg-indigo-50 text-indigo-700",
                depth === 0 && "font-semibold",
                depth === 1 && "font-medium"
              )}
              style={{ paddingLeft: 8 + depth * 16 }}
            >
              <button
                className={cn("w-4 h-4 flex items-center justify-center text-slate-400", !hasKids && "invisible")}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(id);
                }}
              >
                {n.collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {n.task && <span className="text-xs">{n.task.done ? "☑" : "☐"}</span>}
              {n.icon && <span>{n.icon}</span>}
              <span className={cn("truncate", n.task?.done && "line-through opacity-60", !n.text && "italic text-slate-400")}>
                {n.text || "(empty)"}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
