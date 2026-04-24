"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, SkipForward, Clock, Loader2, Diamond } from "lucide-react";

export interface StepNodeData {
  title: string;
  description?: string;
  status: string;
  type: string;
  points: number;
  cost?: number | null;
  timeEstimate?: string | null;
  isSelected?: boolean;
  onClick?: () => void;
  [key: string]: unknown;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5 text-slate-400" />,
  in_progress: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
  stuck: <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />,
  blocked: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  skipped: <SkipForward className="w-3.5 h-3.5 text-slate-500" />,
};

const STATUS_BORDER: Record<string, string> = {
  pending: "border-slate-600",
  in_progress: "border-blue-500",
  completed: "border-green-500",
  stuck: "border-orange-500",
  blocked: "border-red-500",
  skipped: "border-slate-700",
};

const NODE_TYPE_STYLES: Record<string, string> = {
  step: "rounded-xl",
  decision: "rounded-xl rotate-0",
  outcome: "rounded-2xl",
};

export const StepNode = memo(function StepNode({
  data,
}: NodeProps) {
  const nodeData = data as StepNodeData;
  const isOutcome = nodeData.type === "outcome";
  const isDecision = nodeData.type === "decision";

  return (
    <div
      onClick={nodeData.onClick as () => void}
      className={cn(
        "relative bg-card border-2 cursor-pointer transition-all duration-150 select-none",
        "hover:shadow-lg hover:shadow-primary/10",
        STATUS_BORDER[nodeData.status] ?? "border-slate-600",
        NODE_TYPE_STYLES[nodeData.type] ?? "rounded-xl",
        nodeData.isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
        isOutcome && "bg-indigo-950/50 border-indigo-500",
        nodeData.status === "completed" && "bg-green-950/20",
        nodeData.status === "blocked" && "bg-red-950/20",
        nodeData.status === "skipped" && "opacity-60"
      )}
      style={{ minWidth: 200, maxWidth: 220 }}
    >
      {/* Top accent bar */}
      <div
        className={cn(
          "h-1 rounded-t-xl",
          nodeData.status === "completed" && "bg-green-500",
          nodeData.status === "in_progress" && "bg-blue-500",
          nodeData.status === "stuck" && "bg-orange-500",
          nodeData.status === "blocked" && "bg-red-500",
          nodeData.status === "pending" && "bg-slate-600",
          nodeData.status === "skipped" && "bg-slate-700",
          isOutcome && "bg-indigo-500"
        )}
      />

      <div className="px-3 py-2.5">
        {/* Header row */}
        <div className="flex items-start gap-2 mb-1">
          <div className="mt-0.5 shrink-0">
            {isDecision ? (
              <Diamond className="w-3.5 h-3.5 text-yellow-400" />
            ) : isOutcome ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              STATUS_ICON[nodeData.status] ?? STATUS_ICON.pending
            )}
          </div>
          <h3
            className={cn(
              "text-xs font-semibold leading-tight flex-1",
              nodeData.status === "completed"
                ? "text-green-300"
                : nodeData.status === "blocked"
                ? "text-red-300"
                : nodeData.status === "skipped"
                ? "text-muted-foreground line-through"
                : isOutcome
                ? "text-indigo-300"
                : "text-foreground"
            )}
          >
            {nodeData.title}
          </h3>
        </div>

        {/* Description */}
        {nodeData.description && (
          <p className="text-[10px] text-muted-foreground line-clamp-2 ml-5 mb-1.5">
            {nodeData.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between ml-5">
          <div className="flex items-center gap-2">
            {nodeData.timeEstimate && (
              <span className="text-[10px] text-muted-foreground">
                ⏱ {nodeData.timeEstimate}
              </span>
            )}
            {nodeData.cost != null && nodeData.cost > 0 && (
              <span className="text-[10px] text-muted-foreground">
                ${nodeData.cost.toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-yellow-400 font-medium">
              {nodeData.points}pt
            </span>
          </div>
        </div>
      </div>

      {/* React Flow Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-slate-600 !border-slate-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-slate-600 !border-slate-500"
      />
    </div>
  );
});
