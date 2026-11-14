import type { NodeShape } from "./types";

export interface MapTheme {
  id: string;
  name: string;
  canvas: string; // background color
  dots: string; // grid dot color
  rootBg: string;
  rootText: string;
  palette: string[]; // branch colors
  /** How first-level topics render. */
  level1: "filled" | "outlined";
  /** Default shape for deeper topics. */
  deepShape: NodeShape;
  deepBg: string;
  deepText: string;
  connector: "curve" | "straight";
  selection: string;
}

export const THEMES: MapTheme[] = [
  {
    id: "classic",
    name: "Classic",
    canvas: "#f7f8fb",
    dots: "#dfe3ea",
    rootBg: "#24324a",
    rootText: "#ffffff",
    palette: ["#e8590c", "#1c7ed6", "#2f9e44", "#ae3ec9", "#f59f00", "#0ca678", "#e64980", "#4263eb"],
    level1: "filled",
    deepShape: "rounded",
    deepBg: "#ffffff",
    deepText: "#1f2937",
    connector: "curve",
    selection: "#4c6ef5",
  },
  {
    id: "fresh",
    name: "Fresh",
    canvas: "#ffffff",
    dots: "#eef0f3",
    rootBg: "#ffffff",
    rootText: "#111827",
    palette: ["#ff6b6b", "#4dabf7", "#51cf66", "#fcc419", "#9775fa", "#20c997", "#ff922b", "#f06595"],
    level1: "outlined",
    deepShape: "underline",
    deepBg: "transparent",
    deepText: "#1f2937",
    connector: "curve",
    selection: "#228be6",
  },
  {
    id: "ocean",
    name: "Ocean",
    canvas: "#eef6fb",
    dots: "#d3e6f2",
    rootBg: "#0b4f71",
    rootText: "#ffffff",
    palette: ["#1098ad", "#1971c2", "#0b7285", "#3b5bdb", "#15aabf", "#364fc7"],
    level1: "filled",
    deepShape: "pill",
    deepBg: "#ffffff",
    deepText: "#0b2537",
    connector: "curve",
    selection: "#f08c00",
  },
  {
    id: "sunset",
    name: "Sunset",
    canvas: "#fff8f1",
    dots: "#f6e3d2",
    rootBg: "#c2255c",
    rootText: "#ffffff",
    palette: ["#f76707", "#e8590c", "#d6336c", "#ae3ec9", "#f59f00", "#e03131"],
    level1: "filled",
    deepShape: "rounded",
    deepBg: "#ffffff",
    deepText: "#3b1d14",
    connector: "curve",
    selection: "#5f3dc4",
  },
  {
    id: "mono",
    name: "Minimal",
    canvas: "#fafafa",
    dots: "#e9e9e9",
    rootBg: "#111111",
    rootText: "#ffffff",
    palette: ["#333333", "#555555", "#777777", "#444444"],
    level1: "outlined",
    deepShape: "underline",
    deepBg: "transparent",
    deepText: "#222222",
    connector: "straight",
    selection: "#e8590c",
  },
  {
    id: "midnight",
    name: "Midnight",
    canvas: "#141a26",
    dots: "#232c3d",
    rootBg: "#f8f9fa",
    rootText: "#141a26",
    palette: ["#ff8787", "#74c0fc", "#8ce99a", "#ffd43b", "#b197fc", "#63e6be", "#ffa94d", "#faa2c1"],
    level1: "outlined",
    deepShape: "rounded",
    deepBg: "#1d2535",
    deepText: "#e9ecef",
    connector: "curve",
    selection: "#ffd43b",
  },
];

export function getTheme(id: string | undefined): MapTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Topic colors offered in the inspector. */
export const COLOR_SWATCHES = [
  "#e03131", "#e8590c", "#f59f00", "#2f9e44", "#0ca678", "#1098ad",
  "#1c7ed6", "#4263eb", "#7048e8", "#ae3ec9", "#d6336c", "#495057",
];

export const ICON_GROUPS: { label: string; icons: string[] }[] = [
  { label: "Priority", icons: ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "❗", "❓", "⭐"] },
  { label: "Status", icons: ["✅", "❌", "⏳", "🚧", "🔥", "💡", "⚠️", "🎯"] },
  { label: "Feelings", icons: ["😀", "🙂", "😐", "🙁", "😡", "😍", "🤔", "👍"] },
  { label: "Objects", icons: ["📌", "📅", "📎", "💰", "📈", "🏆", "🚀", "🔑"] },
  { label: "People", icons: ["👤", "👥", "🧑‍💻", "📣", "🤝", "💬", "📧", "☎️"] },
];

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function readableText(bg: string): string {
  const rgb = hexToRgb(bg);
  if (!rgb) return "#111827";
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? "#111827" : "#ffffff";
}

export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}
