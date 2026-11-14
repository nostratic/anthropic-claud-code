import type { MindMapData } from "./types";
import type { LayoutResult } from "./layout";
import { FONT_FAMILY, ICON_SIZE, IMAGE_H, BADGE_SIZE } from "./layout";
import type { MapTheme } from "./themes";
import { toMarkdown, toPlainOutline } from "./model";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function radius(shape: string, h: number): number {
  if (shape === "pill") return h / 2;
  if (shape === "rect") return 3;
  if (shape === "rounded") return 10;
  return 0;
}

/** Render the current layout as a standalone SVG document. */
export function buildSVG(
  layout: LayoutResult,
  data: MindMapData,
  theme: MapTheme,
  padding = 40
): { svg: string; width: number; height: number } {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2);
  const tx = padding - minX;
  const ty = padding - minY;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="${theme.canvas}"/>`,
    `<g transform="translate(${tx},${ty})" font-family='${FONT_FAMILY}'>`
  );
  for (const e of layout.edges) {
    parts.push(
      `<path d="${e.d}" fill="none" stroke="${e.color}" stroke-width="${e.width}" stroke-linecap="round"/>`
    );
  }
  for (const id of layout.order) {
    const b = layout.boxes[id];
    const n = data.nodes[id];
    const r = radius(b.shape, b.h);
    if (b.shape !== "underline" && b.shape !== "none") {
      const strokeW = b.depth === 0 ? 0 : b.bg === b.border ? 0 : 1.5;
      parts.push(
        `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${r}" fill="${b.bg === "transparent" ? "none" : b.bg}" stroke="${b.border}" stroke-width="${strokeW}"/>`
      );
    }
    let cx = b.x + b.padX;
    let cy = b.y + b.padY;
    if (n.image) {
      parts.push(
        `<rect x="${cx}" y="${cy}" width="${b.w - b.padX * 2}" height="${IMAGE_H}" rx="6" fill="#e9ecef"/>`,
        `<text x="${b.x + b.w / 2}" y="${cy + IMAGE_H / 2 + 5}" text-anchor="middle" font-size="12" fill="#868e96">image</text>`
      );
      cy += IMAGE_H + 6;
    }
    const textBlockH = b.lines.length * b.lineHeight;
    const midY = cy + textBlockH / 2;
    if (n.task) {
      const done = n.task.done;
      parts.push(
        `<rect x="${cx}" y="${midY - 8}" width="16" height="16" rx="4" fill="${done ? b.color : "#fff"}" stroke="${b.color}" stroke-width="1.5"/>`
      );
      if (done) {
        parts.push(
          `<path d="M ${cx + 4} ${midY} l 3 3 l 5 -6" stroke="#fff" stroke-width="2" fill="none"/>`
        );
      }
      cx += 22;
    }
    if (n.icon) {
      parts.push(
        `<text x="${cx}" y="${midY + ICON_SIZE * 0.35}" font-size="${ICON_SIZE - 2}">${esc(n.icon)}</text>`
      );
      cx += ICON_SIZE + 6;
    }
    b.lines.forEach((line, i) => {
      const y = cy + i * b.lineHeight + b.lineHeight * 0.72;
      parts.push(
        `<text x="${cx}" y="${y}" font-size="${b.fontSize}" font-weight="${b.fontWeight}"${b.italic ? ' font-style="italic"' : ""} fill="${b.text}"${n.task?.done ? ' text-decoration="line-through"' : ""}>${esc(line)}</text>`
      );
    });
    let bx = cx + b.textW + 6;
    for (const badge of b.badges) {
      parts.push(
        `<text x="${bx}" y="${midY + 5}" font-size="${BADGE_SIZE - 4}">${badge === "note" ? "📝" : "🔗"}</text>`
      );
      bx += BADGE_SIZE + 4;
    }
    if (b.hiddenChildren) {
      const ccx = b.side === "left" ? b.x - 12 : b.x + b.w + 12;
      parts.push(
        `<circle cx="${ccx}" cy="${b.y + b.h / 2}" r="10" fill="#fff" stroke="${b.color}" stroke-width="1.5"/>`,
        `<text x="${ccx}" y="${b.y + b.h / 2 + 4}" text-anchor="middle" font-size="10" fill="${b.color}">${b.hiddenChildren}</text>`
      );
    }
  }
  parts.push("</g></svg>");
  return { svg: parts.join(""), width, height };
}

export function download(filename: string, content: Blob | string, type = "text/plain") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(title: string): string {
  return (title || "mind-map").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "mind-map";
}

export async function exportPNG(
  layout: LayoutResult,
  data: MindMapData,
  theme: MapTheme,
  title: string,
  scale = 2
) {
  const { svg, width, height } = buildSVG(layout, data, theme);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not render image"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const c = canvas.getContext("2d")!;
  c.scale(scale, scale);
  c.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (blob) download(`${safeFilename(title)}.png`, blob);
}

export function exportSVG(layout: LayoutResult, data: MindMapData, theme: MapTheme, title: string) {
  const { svg } = buildSVG(layout, data, theme);
  download(`${safeFilename(title)}.svg`, svg, "image/svg+xml");
}

export function exportMarkdown(data: MindMapData, title: string) {
  download(`${safeFilename(title)}.md`, toMarkdown(data), "text/markdown");
}

export function exportText(data: MindMapData, title: string) {
  download(`${safeFilename(title)}.txt`, toPlainOutline(data), "text/plain");
}

export function exportJSON(data: MindMapData, title: string, theme: string, layout: string) {
  download(
    `${safeFilename(title)}.mindmap.json`,
    JSON.stringify({ format: "mindmap/v1", title, theme, layout, data }, null, 2),
    "application/json"
  );
}
