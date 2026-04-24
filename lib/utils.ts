import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-500",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  stuck: "bg-orange-500",
  blocked: "bg-red-500",
  skipped: "bg-slate-400",
  open: "bg-indigo-500",
  in_progress_conflict: "bg-blue-500",
  resolved: "bg-green-500",
  closed: "bg-slate-500",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  stuck: "Stuck",
  blocked: "Blocked",
  skipped: "Skipped",
  open: "Open",
  resolved: "Resolved",
  closed: "Closed",
};

export const NODE_STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: "text-slate-400" },
  { value: "in_progress", label: "In Progress", color: "text-blue-400" },
  { value: "completed", label: "Completed", color: "text-green-400" },
  { value: "stuck", label: "Stuck", color: "text-orange-400" },
  { value: "blocked", label: "Blocked", color: "text-red-400" },
  { value: "skipped", label: "Skipped", color: "text-slate-400" },
];

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}
