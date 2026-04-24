"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { formatRelativeTime, STATUS_COLORS, STATUS_LABELS } from "@/lib/utils";
import type { Conflict, RoadmapShare } from "@/types";
import {
  Plus,
  AlertTriangle,
  Users,
  GitBranch,
  CheckCircle,
  Clock,
  Bell,
  ArrowRight,
  Loader2,
} from "lucide-react";

export default function DashboardPage() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [pendingShares, setPendingShares] = useState<RoadmapShare[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/conflicts").then((r) => r.json()),
      fetch("/api/shares").then((r) => r.json()),
    ]).then(([c, s]) => {
      setConflicts(Array.isArray(c) ? c : []);
      setPendingShares(Array.isArray(s) ? s : []);
      setLoading(false);
    });
  }, []);

  async function handleShareAction(
    shareId: string,
    status: "accepted" | "rejected"
  ) {
    const res = await fetch(`/api/shares/${shareId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setPendingShares((prev) => prev.filter((s) => s.id !== shareId));
    }
  }

  const stats = {
    total: conflicts.length,
    open: conflicts.filter((c) => c.status === "open").length,
    resolved: conflicts.filter((c) => c.status === "resolved").length,
    totalRoadmaps: conflicts.reduce(
      (sum, c) => sum + (c._count?.roadmaps ?? 0),
      0
    ),
  };

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage your conflicts and resolution roadmaps
            </p>
          </div>
          <Link
            href="/conflicts/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            New Conflict
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Conflicts", value: stats.total, icon: AlertTriangle, color: "text-indigo-400" },
            { label: "Open", value: stats.open, icon: Clock, color: "text-yellow-400" },
            { label: "Resolved", value: stats.resolved, icon: CheckCircle, color: "text-green-400" },
            { label: "Roadmaps", value: stats.totalRoadmaps, icon: GitBranch, color: "text-blue-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{label}</p>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
            </div>
          ))}
        </div>

        {/* Pending Shares */}
        {pendingShares.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-yellow-400" />
              <h2 className="font-semibold text-foreground">
                Pending Roadmap Proposals
              </h2>
              <span className="bg-yellow-400/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full font-medium">
                {pendingShares.length}
              </span>
            </div>
            <div className="space-y-3">
              {pendingShares.map((share) => (
                <div
                  key={share.id}
                  className="bg-card border border-yellow-500/20 rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {share.roadmap?.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Shared by {share.sharedBy.name} •{" "}
                      {share.roadmap?.conflict?.title} •{" "}
                      {share.roadmap?._count?.nodes ?? 0} steps
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleShareAction(share.id, "rejected")}
                      className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-secondary transition"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleShareAction(share.id, "accepted")}
                      className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
                    >
                      Accept & Activate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conflicts */}
        <div>
          <h2 className="font-semibold text-foreground mb-4">Your Conflicts</h2>
          {conflicts.length === 0 ? (
            <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
              <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">No conflicts yet</p>
              <p className="text-muted-foreground text-sm mt-1 mb-6">
                Create your first conflict to start building resolution roadmaps
              </p>
              <Link
                href="/conflicts/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition text-sm"
              >
                <Plus className="w-4 h-4" />
                Create Conflict
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {conflicts.map((conflict) => (
                <Link
                  key={conflict.id}
                  href={`/conflicts/${conflict.id}`}
                  className="group bg-card border border-border hover:border-primary/40 rounded-xl p-5 transition"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition truncate">
                        {conflict.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatRelativeTime(conflict.updatedAt)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium text-white ${
                        STATUS_COLORS[conflict.status] ?? "bg-slate-500"
                      }`}
                    >
                      {STATUS_LABELS[conflict.status] ?? conflict.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {conflict.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {conflict.participants.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="w-3.5 h-3.5" />
                        {conflict._count?.roadmaps ?? 0} roadmaps
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 group-hover:text-primary transition" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
