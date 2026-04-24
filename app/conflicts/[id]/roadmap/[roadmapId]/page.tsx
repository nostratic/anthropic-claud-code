"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { NodeDetailPanel } from "@/components/roadmap/NodeDetailPanel";
import type { Roadmap, RoadmapNode } from "@/types";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  Share2,
  Zap,
  Lock,
  Globe,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RoadmapCanvas = dynamic(
  () =>
    import("@/components/roadmap/RoadmapCanvas").then(
      (mod) => mod.RoadmapCanvas
    ),
  { ssr: false }
);

export default function RoadmapViewPage() {
  const params = useParams();
  const router = useRouter();
  const conflictId = params.id as string;
  const roadmapId = params.roadmapId as string;

  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [nodes, setNodes] = useState<RoadmapNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<RoadmapNode | null>(null);
  const [loading, setLoading] = useState(true);

  const [activating, setActivating] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareError, setShareError] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const fetchRoadmap = useCallback(async () => {
    const res = await fetch(`/api/roadmaps/${roadmapId}`);
    if (!res.ok) {
      router.push(`/conflicts/${conflictId}`);
      return;
    }
    const data: Roadmap = await res.json();
    setRoadmap(data);
    setNodes(data.nodes);
    setLoading(false);
  }, [roadmapId, conflictId, router]);

  useEffect(() => {
    fetchRoadmap();
  }, [fetchRoadmap]);

  function handleNodeClick(node: RoadmapNode) {
    const fullNode = nodes.find((n) => n.id === node.id) ?? node;
    setSelectedNode(fullNode);
  }

  function handleNodeUpdate(updatedNode: RoadmapNode) {
    setNodes((prev) =>
      prev.map((n) => (n.id === updatedNode.id ? updatedNode : n))
    );
    setSelectedNode(updatedNode);
  }

  async function activateRoadmap() {
    setActivating(true);
    const res = await fetch(`/api/roadmaps/${roadmapId}/activate`, {
      method: "POST",
    });
    setActivating(false);
    if (res.ok) {
      const updated = await res.json();
      setRoadmap((prev) => (prev ? { ...prev, isActive: updated.isActive, status: updated.status } : prev));
    }
  }

  async function suggestWithAI() {
    setAiLoading(true);
    const res = await fetch(`/api/roadmaps/${roadmapId}/suggest`, {
      method: "POST",
    });
    setAiLoading(false);
    if (res.ok) {
      const updatedRoadmap: Roadmap = await res.json();
      setRoadmap(updatedRoadmap);
      setNodes(updatedRoadmap.nodes);
    }
  }

  async function shareRoadmap(e: React.FormEvent) {
    e.preventDefault();
    setShareError("");
    setShareLoading(true);
    const res = await fetch(`/api/roadmaps/${roadmapId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: shareEmail }),
    });
    setShareLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setShareError(data.error || "Failed to share");
      return;
    }
    setShareEmail("");
    setShowShare(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!roadmap) return null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Navbar />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href={`/conflicts/${conflictId}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            {roadmap.isPersonal ? (
              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <h1 className="font-semibold text-foreground text-sm truncate max-w-xs">
              {roadmap.title}
            </h1>
            {roadmap.isActive && (
              <span className="flex items-center gap-1 text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">
                <CheckCircle className="w-3 h-3" />
                Active
              </span>
            )}
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-medium",
                roadmap.type === "multipath"
                  ? "bg-purple-500/20 text-purple-400"
                  : "bg-blue-500/20 text-blue-400"
              )}
            >
              {roadmap.type === "multipath" ? "Multi-path" : "Linear"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {nodes.length === 0 && (
            <button
              onClick={suggestWithAI}
              disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 rounded-lg transition disabled:opacity-50"
            >
              {aiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              AI Suggest Steps
            </button>
          )}

          {!roadmap.isActive && (
            <button
              onClick={activateRoadmap}
              disabled={activating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition disabled:opacity-50"
            >
              {activating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              Set Active
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg hover:bg-secondary transition text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 w-40 bg-card border border-border rounded-xl shadow-xl py-1 z-50">
                <button
                  onClick={() => {
                    setShowShare(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share Proposal
                </button>
                {nodes.length > 0 && (
                  <button
                    onClick={() => {
                      suggestWithAI();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Re-generate AI
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main area: canvas + optional side panel */}
      <div className="flex-1 flex overflow-hidden">
        <RoadmapCanvas
          roadmapNodes={nodes}
          roadmapType={roadmap.type}
          selectedNodeId={selectedNode?.id ?? null}
          onNodeClick={handleNodeClick}
          onNodeUpdate={handleNodeUpdate}
        />

        {/* Detail panel */}
        {selectedNode && (
          <div className="w-80 shrink-0 overflow-hidden border-l border-border">
            <NodeDetailPanel
              node={selectedNode}
              roadmapId={roadmapId}
              onClose={() => setSelectedNode(null)}
              onNodeUpdate={handleNodeUpdate}
            />
          </div>
        )}
      </div>

      {/* Share modal */}
      {showShare && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-foreground mb-1">
              Share as Proposal
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Send this roadmap to a conflict participant. They can review and
              accept it to make it the active roadmap.
            </p>
            <form onSubmit={shareRoadmap} className="space-y-3">
              {shareError && (
                <p className="text-destructive text-xs">{shareError}</p>
              )}
              <input
                type="email"
                required
                placeholder="Participant email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={shareLoading}
                  className="flex-1 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {shareLoading && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  Send
                </button>
                <button
                  type="button"
                  onClick={() => setShowShare(false)}
                  className="px-3 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-secondary transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
