"use client";

import { memo, useEffect, useRef } from "react";
import type { MindNode } from "@/lib/mindmap/types";
import { FONT_FAMILY, ICON_SIZE, IMAGE_H, BADGE_SIZE, type NodeBox } from "@/lib/mindmap/layout";
import type { MapTheme } from "@/lib/mindmap/themes";
import { withAlpha } from "@/lib/mindmap/themes";

interface Props {
  node: MindNode;
  box: NodeBox;
  theme: MapTheme;
  selected: boolean;
  isRoot: boolean;
  editing: boolean;
  draft: string;
  dropInto: boolean;
  searchHit: boolean;
  dimmed: boolean;
  readOnly: boolean;
  onDraftChange: (v: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onEditBlur: () => void;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onDoubleClick: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onAddChild: (id: string) => void;
  onToggleTask: (id: string) => void;
  onOpenNote: (id: string) => void;
}

function radiusFor(shape: NodeBox["shape"], h: number): number | string {
  switch (shape) {
    case "pill":
      return h / 2;
    case "rect":
      return 3;
    case "rounded":
      return 10;
    default:
      return 0;
  }
}

function NodeViewImpl(p: Props) {
  const { node, box: b, theme, selected, editing } = p;
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && taRef.current) {
      const ta = taRef.current;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [editing]);

  const boxed = b.shape !== "underline" && b.shape !== "none";
  const borderW = b.depth === 0 || !boxed ? 0 : b.bg === b.border ? 0 : 1.5;
  const textBlockH = b.lines.length * b.lineHeight;
  const done = !!node.task?.done;
  const hasKids = node.children.length > 0;
  const outerLeft = b.side === "left";

  return (
    <div
      data-node-id={node.id}
      className="mm-node absolute select-none"
      style={{
        left: b.x,
        top: b.y,
        width: b.w,
        height: b.h,
        opacity: p.dimmed ? 0.35 : 1,
      }}
      onPointerDown={(e) => p.onPointerDown(e, node.id)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        p.onDoubleClick(node.id);
      }}
    >
      {/* Body */}
      <div
        className="absolute inset-0 transition-shadow"
        style={{
          background: b.bg,
          border: borderW ? `${borderW}px solid ${b.border}` : undefined,
          borderRadius: radiusFor(b.shape, b.h),
          boxShadow:
            b.depth === 0
              ? "0 6px 18px rgba(15,23,42,.18)"
              : b.depth === 1 && boxed
                ? "0 2px 6px rgba(15,23,42,.10)"
                : undefined,
          outline: selected
            ? `2.5px solid ${theme.selection}`
            : p.dropInto
              ? `2.5px dashed ${theme.selection}`
              : p.searchHit
                ? "3px solid #fcc419"
                : undefined,
          outlineOffset: 3,
          cursor: p.readOnly ? "default" : editing ? "text" : "pointer",
        }}
      />

      {/* Content */}
      <div
        className="absolute flex flex-col"
        style={{
          left: b.padX,
          top: b.padY,
          right: b.padX,
          bottom: b.padY,
        }}
      >
        {node.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={node.image}
            alt=""
            draggable={false}
            className="rounded-md object-cover mb-1.5 bg-black/5"
            style={{ width: "100%", height: IMAGE_H }}
          />
        )}
        <div className="flex items-center" style={{ height: textBlockH }}>
          {node.task && (
            <button
              className="shrink-0 rounded flex items-center justify-center mr-1.5"
              style={{
                width: 16,
                height: 16,
                border: `1.5px solid ${b.depth === 1 && theme.level1 === "filled" ? b.text : b.color}`,
                background: done ? b.color : "#fff",
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                p.onToggleTask(node.id);
              }}
              title={done ? "Mark as not done" : "Mark as done"}
            >
              {done && (
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M1.5 5.2 L4 7.5 L8.5 2.5" stroke="#fff" strokeWidth="1.8" fill="none" />
                </svg>
              )}
            </button>
          )}
          {node.icon && (
            <span
              className="shrink-0 mr-1.5 leading-none"
              style={{ width: ICON_SIZE, fontSize: ICON_SIZE - 2, textAlign: "center" }}
            >
              {node.icon}
            </span>
          )}
          {editing ? (
            <textarea
              ref={taRef}
              value={p.draft}
              onChange={(e) => p.onDraftChange(e.target.value)}
              onKeyDown={p.onEditKeyDown}
              onBlur={p.onEditBlur}
              onPointerDown={(e) => e.stopPropagation()}
              rows={1}
              spellCheck
              className="resize-none bg-transparent outline-none border-0 p-0 m-0 overflow-hidden"
              style={{
                width: b.textW + 4,
                height: textBlockH,
                font: `${b.italic ? "italic " : ""}${b.fontWeight} ${b.fontSize}px ${FONT_FAMILY}`,
                lineHeight: `${b.lineHeight}px`,
                color: b.text,
                whiteSpace: "pre-wrap",
                caretColor: b.text,
              }}
            />
          ) : (
            <span
              className="block"
              style={{
                width: b.textW + 1,
                font: `${b.italic ? "italic " : ""}${b.fontWeight} ${b.fontSize}px ${FONT_FAMILY}`,
                lineHeight: `${b.lineHeight}px`,
                color: b.text,
                whiteSpace: "pre",
                textDecoration: done ? "line-through" : undefined,
                opacity: done ? 0.7 : 1,
              }}
            >
              {node.text ? b.lines.join("\n") : <span style={{ opacity: 0.45 }}>&nbsp;</span>}
            </span>
          )}
          {b.badges.length > 0 && (
            <span className="flex items-center gap-1 ml-1.5 shrink-0">
              {node.note && (
                <button
                  title={node.note}
                  className="leading-none hover:scale-110 transition"
                  style={{ fontSize: BADGE_SIZE - 3 }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    p.onOpenNote(node.id);
                  }}
                >
                  📝
                </button>
              )}
              {node.link && (
                <a
                  href={node.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={node.link}
                  className="leading-none hover:scale-110 transition"
                  style={{ fontSize: BADGE_SIZE - 3 }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  🔗
                </a>
              )}
            </span>
          )}
        </div>
        {node.task && !done && (node.task.progress ?? 0) > 0 && (
          <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: withAlpha(b.color, 0.2) }}>
            <div className="h-full rounded-full" style={{ width: `${node.task.progress}%`, background: b.color }} />
          </div>
        )}
      </div>

      {/* Collapse / expand toggle */}
      {hasKids && !p.isRoot && (b.hiddenChildren > 0 || selected) && (
        <button
          className="absolute flex items-center justify-center rounded-full text-[10px] font-semibold bg-white hover:scale-110 transition"
          style={{
            width: 20,
            height: 20,
            top: (b.shape === "underline" ? b.h : b.h / 2) - 10,
            [outerLeft ? "left" : "right"]: -24,
            border: `1.5px solid ${b.color}`,
            color: b.color,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            p.onToggleCollapse(node.id);
          }}
          title={b.hiddenChildren ? `Expand (${b.hiddenChildren} hidden)` : "Collapse"}
        >
          {b.hiddenChildren ? b.hiddenChildren : "−"}
        </button>
      )}

      {/* Quick add child */}
      {selected && !editing && !p.readOnly && b.hiddenChildren === 0 && (
        <button
          className="absolute flex items-center justify-center rounded-full text-white shadow-md hover:scale-110 transition"
          style={{
            width: 22,
            height: 22,
            top: b.h / 2 - 11,
            [outerLeft ? "left" : "right"]: hasKids && !p.isRoot ? -52 : -30,
            background: theme.selection,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            p.onAddChild(node.id);
          }}
          title="Add subtopic (Tab)"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M6 1v10M1 6h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

export const NodeView = memo(NodeViewImpl);
