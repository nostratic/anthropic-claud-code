"use client";

import { useState } from "react";
import type { RoadmapNode } from "@/types";
import {
  X,
  Clock,
  DollarSign,
  Star,
  Target,
  AlertTriangle,
  Lightbulb,
  ListChecks,
  History,
  ChevronDown,
  ChevronUp,
  Plus,
  Loader2,
  Save,
  GitBranch,
} from "lucide-react";
import { cn, NODE_STATUS_OPTIONS, formatRelativeTime } from "@/lib/utils";

interface NodeDetailPanelProps {
  node: RoadmapNode;
  roadmapId: string;
  onClose: () => void;
  onNodeUpdate: (node: RoadmapNode) => void;
}

const STATUS_COLORS_TEXT: Record<string, string> = {
  pending: "text-slate-400 bg-slate-400/10",
  in_progress: "text-blue-400 bg-blue-400/10",
  completed: "text-green-400 bg-green-400/10",
  stuck: "text-orange-400 bg-orange-400/10",
  blocked: "text-red-400 bg-red-400/10",
  skipped: "text-slate-500 bg-slate-500/10",
};

export function NodeDetailPanel({
  node,
  roadmapId,
  onClose,
  onNodeUpdate,
}: NodeDetailPanelProps) {
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState(node.status);
  const [statusComment, setStatusComment] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    title: node.title,
    description: node.description ?? "",
    cost: node.cost?.toString() ?? "",
    timeEstimate: node.timeEstimate ?? "",
    points: node.points.toString(),
    consequences: node.consequences ?? "",
    prerequisites: node.prerequisites ?? "",
    assumptions: node.assumptions ?? "",
    kpis: node.kpis ?? "",
  });
  const [editLoading, setEditLoading] = useState(false);

  const [showSubstepForm, setShowSubstepForm] = useState(false);
  const [substepTitle, setSubstepTitle] = useState("");
  const [substepDesc, setSubstepDesc] = useState("");
  const [substepLoading, setSubstepLoading] = useState(false);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    details: true,
    substeps: true,
    history: false,
  });

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  async function changeStatus() {
    setStatusLoading(true);
    const res = await fetch(
      `/api/roadmaps/${roadmapId}/nodes/${node.id}/status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, comment: statusComment }),
      }
    );
    setStatusLoading(false);
    if (res.ok) {
      const { node: updated } = await res.json();
      onNodeUpdate(updated);
      setStatusModal(false);
      setStatusComment("");
    }
  }

  async function saveEdits() {
    setEditLoading(true);
    const res = await fetch(
      `/api/roadmaps/${roadmapId}/nodes/${node.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editData.title,
          description: editData.description || null,
          cost: editData.cost ? parseFloat(editData.cost) : null,
          timeEstimate: editData.timeEstimate || null,
          points: parseInt(editData.points) || 10,
          consequences: editData.consequences || null,
          prerequisites: editData.prerequisites || null,
          assumptions: editData.assumptions || null,
          kpis: editData.kpis || null,
        }),
      }
    );
    setEditLoading(false);
    if (res.ok) {
      const updated = await res.json();
      onNodeUpdate(updated);
      setEditMode(false);
    }
  }

  async function addSubstep(e: React.FormEvent) {
    e.preventDefault();
    setSubstepLoading(true);
    const res = await fetch(`/api/roadmaps/${roadmapId}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: substepTitle,
        description: substepDesc,
        parentId: node.id,
        order: (node.children?.length ?? 0),
        type: "step",
        points: 10,
      }),
    });
    setSubstepLoading(false);
    if (res.ok) {
      const newNode = await res.json();
      const updatedNode = {
        ...node,
        children: [...(node.children ?? []), newNode],
      };
      onNodeUpdate(updatedNode);
      setSubstepTitle("");
      setSubstepDesc("");
      setShowSubstepForm(false);
    }
  }

  const currentNode = node;

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div className="flex-1 min-w-0 mr-2">
          {editMode ? (
            <input
              value={editData.title}
              onChange={(e) =>
                setEditData((prev) => ({ ...prev, title: e.target.value }))
              }
              className="w-full text-sm font-semibold bg-secondary border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          ) : (
            <h2 className="font-semibold text-foreground text-sm leading-snug">
              {currentNode.title}
            </h2>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                STATUS_COLORS_TEXT[currentNode.status] ?? "text-slate-400"
              )}
            >
              {currentNode.status.replace("_", " ")}
            </span>
            <span className="text-xs text-yellow-400">
              ⭐ {currentNode.points}pt
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              {currentNode.type}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-secondary transition text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Description */}
        <div className="p-4 border-b border-border">
          {editMode ? (
            <textarea
              rows={3}
              value={editData.description}
              onChange={(e) =>
                setEditData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Description..."
              className="w-full text-xs bg-secondary border border-border rounded-lg px-2 py-1.5 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {currentNode.description || (
                <span className="italic">No description</span>
              )}
            </p>
          )}
        </div>

        {/* Status Actions */}
        <div className="p-4 border-b border-border">
          <button
            onClick={() => {
              setNewStatus(currentNode.status);
              setStatusModal(true);
            }}
            className="w-full py-2 text-xs font-medium border border-border rounded-lg hover:bg-secondary transition text-foreground"
          >
            Change Status
          </button>
        </div>

        {/* Details Section */}
        <div className="border-b border-border">
          <button
            onClick={() => toggle("details")}
            className="w-full flex items-center justify-between p-4 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
          >
            Details & Metadata
            {expanded.details ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {expanded.details && (
            <div className="px-4 pb-4 space-y-3">
              {editMode ? (
                <>
                  <DetailEditField
                    label="Cost ($)"
                    icon={<DollarSign className="w-3 h-3" />}
                    value={editData.cost}
                    onChange={(v) =>
                      setEditData((prev) => ({ ...prev, cost: v }))
                    }
                    type="number"
                    placeholder="e.g. 5000"
                  />
                  <DetailEditField
                    label="Time Estimate"
                    icon={<Clock className="w-3 h-3" />}
                    value={editData.timeEstimate}
                    onChange={(v) =>
                      setEditData((prev) => ({ ...prev, timeEstimate: v }))
                    }
                    placeholder="e.g. 2 weeks"
                  />
                  <DetailEditField
                    label="Points (Impact)"
                    icon={<Star className="w-3 h-3" />}
                    value={editData.points}
                    onChange={(v) =>
                      setEditData((prev) => ({ ...prev, points: v }))
                    }
                    type="number"
                    placeholder="1–100"
                  />
                  <DetailEditTextarea
                    label="Prerequisites"
                    icon={<ListChecks className="w-3 h-3" />}
                    value={editData.prerequisites}
                    onChange={(v) =>
                      setEditData((prev) => ({ ...prev, prerequisites: v }))
                    }
                    placeholder="What must be done before this step..."
                  />
                  <DetailEditTextarea
                    label="Assumptions"
                    icon={<Lightbulb className="w-3 h-3" />}
                    value={editData.assumptions}
                    onChange={(v) =>
                      setEditData((prev) => ({ ...prev, assumptions: v }))
                    }
                    placeholder="What we assume to be true..."
                  />
                  <DetailEditTextarea
                    label="KPIs / Success Criteria"
                    icon={<Target className="w-3 h-3" />}
                    value={editData.kpis}
                    onChange={(v) =>
                      setEditData((prev) => ({ ...prev, kpis: v }))
                    }
                    placeholder="How we measure success..."
                  />
                  <DetailEditTextarea
                    label="Consequences if Skipped"
                    icon={<AlertTriangle className="w-3 h-3" />}
                    value={editData.consequences}
                    onChange={(v) =>
                      setEditData((prev) => ({ ...prev, consequences: v }))
                    }
                    placeholder="What happens if this step is skipped..."
                  />
                </>
              ) : (
                <>
                  <DetailReadField
                    label="Cost"
                    icon={<DollarSign className="w-3 h-3" />}
                    value={
                      currentNode.cost != null
                        ? `$${currentNode.cost.toLocaleString()}`
                        : null
                    }
                  />
                  <DetailReadField
                    label="Time Estimate"
                    icon={<Clock className="w-3 h-3" />}
                    value={currentNode.timeEstimate}
                  />
                  <DetailReadField
                    label="Points"
                    icon={<Star className="w-3 h-3" />}
                    value={`${currentNode.points} points`}
                  />
                  <DetailReadField
                    label="Prerequisites"
                    icon={<ListChecks className="w-3 h-3" />}
                    value={currentNode.prerequisites}
                  />
                  <DetailReadField
                    label="Assumptions"
                    icon={<Lightbulb className="w-3 h-3" />}
                    value={currentNode.assumptions}
                  />
                  <DetailReadField
                    label="KPIs"
                    icon={<Target className="w-3 h-3" />}
                    value={currentNode.kpis}
                  />
                  <DetailReadField
                    label="Consequences"
                    icon={<AlertTriangle className="w-3 h-3" />}
                    value={currentNode.consequences}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Sub-steps */}
        <div className="border-b border-border">
          <button
            onClick={() => toggle("substeps")}
            className="w-full flex items-center justify-between p-4 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
          >
            <span className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5" />
              Sub-steps ({currentNode.children?.length ?? 0})
            </span>
            {expanded.substeps ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {expanded.substeps && (
            <div className="px-4 pb-4 space-y-2">
              {currentNode.children?.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-2 py-1.5 px-2 bg-secondary/50 rounded-lg"
                >
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      child.status === "completed"
                        ? "bg-green-400"
                        : child.status === "in_progress"
                        ? "bg-blue-400"
                        : child.status === "blocked"
                        ? "bg-red-400"
                        : child.status === "stuck"
                        ? "bg-orange-400"
                        : "bg-slate-500"
                    )}
                  />
                  <span className="text-xs text-foreground flex-1 truncate">
                    {child.title}
                  </span>
                  <span className="text-[10px] text-yellow-400 shrink-0">
                    {child.points}pt
                  </span>
                </div>
              ))}

              {showSubstepForm ? (
                <form onSubmit={addSubstep} className="space-y-2 mt-2">
                  <input
                    required
                    value={substepTitle}
                    onChange={(e) => setSubstepTitle(e.target.value)}
                    placeholder="Sub-step title"
                    className="w-full px-2 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <textarea
                    rows={2}
                    value={substepDesc}
                    onChange={(e) => setSubstepDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full px-2 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={substepLoading}
                      className="flex-1 py-1.5 text-xs font-medium bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {substepLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSubstepForm(false)}
                      className="px-2 py-1.5 text-xs text-muted-foreground border border-border rounded-lg hover:bg-secondary transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowSubstepForm(true)}
                  className="w-full py-1.5 text-xs text-muted-foreground border border-dashed border-border rounded-lg hover:bg-secondary hover:text-foreground transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3 h-3" />
                  Add Sub-step
                </button>
              )}
            </div>
          )}
        </div>

        {/* Status History */}
        <div>
          <button
            onClick={() => toggle("history")}
            className="w-full flex items-center justify-between p-4 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
          >
            <span className="flex items-center gap-2">
              <History className="w-3.5 h-3.5" />
              History ({currentNode.statusHistory?.length ?? 0})
            </span>
            {expanded.history ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {expanded.history && (
            <div className="px-4 pb-4 space-y-2">
              {(currentNode.statusHistory?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No status changes yet
                </p>
              ) : (
                currentNode.statusHistory?.map((h) => (
                  <div
                    key={h.id}
                    className="border-l-2 border-border pl-3 py-1"
                  >
                    <p className="text-xs text-foreground">
                      <span className="text-muted-foreground">
                        {h.oldStatus}
                      </span>{" "}
                      →{" "}
                      <span
                        className={cn(
                          "font-medium",
                          STATUS_COLORS_TEXT[h.newStatus]?.split(" ")[0] ??
                            "text-foreground"
                        )}
                      >
                        {h.newStatus.replace("_", " ")}
                      </span>
                    </p>
                    {h.comment && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 italic">
                        &quot;{h.comment}&quot;
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {h.user.name} • {formatRelativeTime(h.changedAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-border flex items-center gap-2">
        {editMode ? (
          <>
            <button
              onClick={saveEdits}
              disabled={editLoading}
              className="flex-1 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {editLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save Changes
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="px-3 py-2 text-xs text-muted-foreground border border-border rounded-lg hover:bg-secondary transition"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="w-full py-2 text-xs font-medium border border-border rounded-lg hover:bg-secondary transition text-muted-foreground hover:text-foreground"
          >
            Edit Details
          </button>
        )}
      </div>

      {/* Status change modal */}
      {statusModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-foreground mb-4">
              Update Step Status
            </h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {NODE_STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setNewStatus(opt.value)}
                  className={cn(
                    "py-2 px-3 text-xs font-medium rounded-lg border transition",
                    newStatus === opt.value
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
              placeholder="Add a comment (optional)"
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={changeStatus}
                disabled={statusLoading || newStatus === currentNode.status}
                className="flex-1 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {statusLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Update Status
              </button>
              <button
                onClick={() => setStatusModal(false)}
                className="px-3 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-secondary transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailReadField({
  label,
  icon,
  value,
}: {
  label: string;
  icon: React.ReactNode;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xs text-foreground leading-relaxed pl-4">{value}</p>
    </div>
  );
}

function DetailEditField({
  label,
  icon,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function DetailEditTextarea({
  label,
  icon,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
      />
    </div>
  );
}
