"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { formatRelativeTime, STATUS_COLORS, STATUS_LABELS } from "@/lib/utils";
import type { Conflict, Roadmap, Note } from "@/types";
import {
  ArrowLeft,
  Plus,
  Users,
  GitBranch,
  StickyNote,
  Loader2,
  Sparkles,
  CheckCircle,
  Star,
  Share2,
  Lock,
  Globe,
  Trash2,
  UserPlus,
  ArrowRight,
  Zap,
} from "lucide-react";

export default function ConflictDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const conflictId = params.id as string;

  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const [newNote, setNewNote] = useState("");
  const [noteShared, setNoteShared] = useState(false);
  const [noteLoading, setNoteLoading] = useState(false);

  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [participantEmail, setParticipantEmail] = useState("");
  const [participantError, setParticipantError] = useState("");
  const [participantLoading, setParticipantLoading] = useState(false);

  const [showNewRoadmap, setShowNewRoadmap] = useState(false);
  const [roadmapTitle, setRoadmapTitle] = useState("");
  const [roadmapType, setRoadmapType] = useState<"linear" | "multipath">("linear");
  const [roadmapPersonal, setRoadmapPersonal] = useState(false);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const [shareRoadmapId, setShareRoadmapId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareError, setShareError] = useState("");
  const [shareLoading, setShareLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [conflictRes, roadmapsRes, notesRes] = await Promise.all([
      fetch(`/api/conflicts/${conflictId}`),
      fetch(`/api/conflicts/${conflictId}/roadmaps`),
      fetch(`/api/conflicts/${conflictId}/notes`),
    ]);
    if (!conflictRes.ok) {
      router.push("/dashboard");
      return;
    }
    const [c, r, n] = await Promise.all([
      conflictRes.json(),
      roadmapsRes.json(),
      notesRes.json(),
    ]);
    setConflict(c);
    setRoadmaps(Array.isArray(r) ? r : []);
    setNotes(Array.isArray(n) ? n : []);
    setLoading(false);
  }, [conflictId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function addParticipant(e: React.FormEvent) {
    e.preventDefault();
    setParticipantError("");
    setParticipantLoading(true);
    const res = await fetch(`/api/conflicts/${conflictId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: participantEmail }),
    });
    setParticipantLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setParticipantError(data.error || "Failed to add participant");
      return;
    }
    setParticipantEmail("");
    setShowAddParticipant(false);
    fetchData();
  }

  async function createRoadmap(e: React.FormEvent) {
    e.preventDefault();
    setRoadmapLoading(true);
    const res = await fetch(`/api/conflicts/${conflictId}/roadmaps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: roadmapTitle,
        type: roadmapType,
        isPersonal: roadmapPersonal,
      }),
    });
    setRoadmapLoading(false);
    if (res.ok) {
      const roadmap = await res.json();
      setRoadmapTitle("");
      setShowNewRoadmap(false);
      router.push(`/conflicts/${conflictId}/roadmap/${roadmap.id}`);
    }
  }

  async function suggestWithAI(roadmapId: string) {
    setAiLoading(roadmapId);
    const res = await fetch(`/api/roadmaps/${roadmapId}/suggest`, {
      method: "POST",
    });
    setAiLoading(null);
    if (res.ok) {
      router.push(`/conflicts/${conflictId}/roadmap/${roadmapId}`);
    }
  }

  async function createAndSuggest() {
    setRoadmapLoading(true);
    const res = await fetch(`/api/conflicts/${conflictId}/roadmaps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "AI Suggested Roadmap",
        type: "linear",
        isPersonal: false,
      }),
    });
    if (!res.ok) {
      setRoadmapLoading(false);
      return;
    }
    const roadmap = await res.json();
    setRoadmapLoading(false);
    await suggestWithAI(roadmap.id);
  }

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setNoteLoading(true);
    const res = await fetch(`/api/conflicts/${conflictId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newNote, isShared: noteShared }),
    });
    setNoteLoading(false);
    if (res.ok) {
      const note = await res.json();
      setNotes((prev) => [note, ...prev]);
      setNewNote("");
      setNoteShared(false);
    }
  }

  async function deleteNote(noteId: string) {
    const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
    if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  async function toggleNoteShare(note: Note) {
    const res = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isShared: !note.isShared }),
    });
    if (res.ok) {
      const updated = await res.json();
      setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)));
    }
  }

  async function shareRoadmap(e: React.FormEvent) {
    e.preventDefault();
    if (!shareRoadmapId) return;
    setShareError("");
    setShareLoading(true);
    const res = await fetch(`/api/roadmaps/${shareRoadmapId}/share`, {
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
    setShareRoadmapId(null);
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

  if (!conflict) return null;

  const activeRoadmap = roadmaps.find((r) => r.isActive);
  const otherRoadmaps = roadmaps.filter((r) => !r.isActive);
  const myNotes = notes.filter((n) => n.userId === session?.user?.id);
  const sharedFromOthers = notes.filter(
    (n) => n.userId !== session?.user?.id && n.isShared
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>

        {/* Conflict Header */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-foreground">
                  {conflict.title}
                </h1>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium text-white ${
                    STATUS_COLORS[conflict.status] ?? "bg-slate-500"
                  }`}
                >
                  {STATUS_LABELS[conflict.status] ?? conflict.status}
                </span>
              </div>
              <p className="text-muted-foreground">{conflict.description}</p>
              <p className="text-xs text-muted-foreground mt-3">
                Created {formatRelativeTime(conflict.createdAt)} by{" "}
                {conflict.createdBy.name}
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column: Roadmaps */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Roadmap */}
            {activeRoadmap && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Active Roadmap
                </h2>
                <Link
                  href={`/conflicts/${conflictId}/roadmap/${activeRoadmap.id}`}
                  className="group block bg-card border border-green-500/30 hover:border-green-500/60 rounded-xl p-5 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition">
                          {activeRoadmap.title}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {activeRoadmap._count?.nodes ?? 0} steps • by{" "}
                        {activeRoadmap.createdBy.name} •{" "}
                        {activeRoadmap.type === "multipath"
                          ? "Multi-path"
                          : "Linear"}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition mt-0.5" />
                  </div>
                </Link>
              </div>
            )}

            {/* All Roadmaps */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Roadmaps
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={createAndSuggest}
                    disabled={roadmapLoading || !!aiLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 rounded-lg transition disabled:opacity-50"
                  >
                    {aiLoading || roadmapLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    AI Suggest
                  </button>
                  <button
                    onClick={() => setShowNewRoadmap(!showNewRoadmap)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/20 text-primary hover:bg-primary/30 rounded-lg transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Manual
                  </button>
                </div>
              </div>

              {showNewRoadmap && (
                <form
                  onSubmit={createRoadmap}
                  className="bg-card border border-primary/30 rounded-xl p-4 mb-3 space-y-3"
                >
                  <input
                    type="text"
                    required
                    placeholder="Roadmap title"
                    value={roadmapTitle}
                    onChange={(e) => setRoadmapTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex items-center gap-3">
                    <select
                      value={roadmapType}
                      onChange={(e) =>
                        setRoadmapType(
                          e.target.value as "linear" | "multipath"
                        )
                      }
                      className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="linear">Linear</option>
                      <option value="multipath">Multi-path</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roadmapPersonal}
                        onChange={(e) => setRoadmapPersonal(e.target.checked)}
                        className="rounded"
                      />
                      Private
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={roadmapLoading}
                      className="flex-1 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {roadmapLoading && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      )}
                      Create Roadmap
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewRoadmap(false)}
                      className="px-3 py-2 text-xs text-muted-foreground border border-border rounded-lg hover:bg-secondary transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {otherRoadmaps.length === 0 && !activeRoadmap && (
                <div className="text-center py-8 bg-card border border-dashed border-border rounded-xl">
                  <GitBranch className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No roadmaps yet. Create one manually or let AI suggest one.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {otherRoadmaps.map((roadmap) => (
                  <div
                    key={roadmap.id}
                    className="group bg-card border border-border hover:border-border/80 rounded-xl p-4 flex items-center gap-3"
                  >
                    <Link
                      href={`/conflicts/${conflictId}/roadmap/${roadmap.id}`}
                      className="flex-1 min-w-0"
                    >
                      <div className="flex items-center gap-2">
                        {roadmap.isPersonal ? (
                          <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-medium text-sm text-foreground hover:text-primary transition truncate">
                          {roadmap.title}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 ml-5">
                        {roadmap._count?.nodes ?? 0} steps • by{" "}
                        {roadmap.createdBy.name} •{" "}
                        <span
                          className={`${STATUS_COLORS[roadmap.status] ?? ""} text-white px-1.5 py-0.5 rounded text-[10px]`}
                        >
                          {roadmap.status}
                        </span>
                      </p>
                    </Link>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      {roadmap.createdById === session?.user?.id && (
                        <>
                          <button
                            onClick={() => {
                              setShareRoadmapId(roadmap.id);
                              setShareEmail("");
                              setShareError("");
                            }}
                            className="p-1.5 rounded hover:bg-secondary transition text-muted-foreground hover:text-foreground"
                            title="Share as proposal"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          {roadmap._count?.nodes === 0 && (
                            <button
                              onClick={() => suggestWithAI(roadmap.id)}
                              disabled={aiLoading === roadmap.id}
                              className="p-1.5 rounded hover:bg-indigo-500/20 transition text-muted-foreground hover:text-indigo-300 disabled:opacity-50"
                              title="Suggest with AI"
                            >
                              {aiLoading === roadmap.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Zap className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Share roadmap modal */}
              {shareRoadmapId && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                  <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm">
                    <h3 className="font-semibold text-foreground mb-1">
                      Share Roadmap Proposal
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Send this roadmap to a participant. They can accept it to
                      make it the active roadmap.
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
                          Send Proposal
                        </button>
                        <button
                          type="button"
                          onClick={() => setShareRoadmapId(null)}
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
          </div>

          {/* Right column: Participants & Notes */}
          <div className="space-y-6">
            {/* Participants */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <h2 className="font-semibold text-sm text-foreground">
                    Participants ({conflict.participants.length})
                  </h2>
                </div>
                <button
                  onClick={() => setShowAddParticipant(!showAddParticipant)}
                  className="text-primary hover:text-primary/80 transition"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>

              {showAddParticipant && (
                <form
                  onSubmit={addParticipant}
                  className="mb-4 space-y-2"
                >
                  {participantError && (
                    <p className="text-destructive text-xs">{participantError}</p>
                  )}
                  <input
                    type="email"
                    required
                    placeholder="User email"
                    value={participantEmail}
                    onChange={(e) => setParticipantEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    disabled={participantLoading}
                    className="w-full py-1.5 text-xs font-medium bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {participantLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    Add Participant
                  </button>
                </form>
              )}

              <div className="space-y-2">
                {conflict.participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                      {p.user.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {p.user.name}
                        {p.user.id === session?.user?.id && (
                          <span className="text-primary text-xs ml-1">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.role}</p>
                    </div>
                    {p.role === "admin" && (
                      <Star className="w-3 h-3 text-yellow-400 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <StickyNote className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm text-foreground">
                  Notes
                </h2>
              </div>

              <form onSubmit={submitNote} className="mb-4 space-y-2">
                <textarea
                  rows={3}
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noteShared}
                      onChange={(e) => setNoteShared(e.target.checked)}
                      className="rounded"
                    />
                    Share with team
                  </label>
                  <button
                    type="submit"
                    disabled={noteLoading || !newNote.trim()}
                    className="px-3 py-1.5 text-xs font-medium bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition disabled:opacity-50"
                  >
                    Add Note
                  </button>
                </div>
              </form>

              {/* Shared notes from others */}
              {sharedFromOthers.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                    Team Notes
                  </p>
                  <div className="space-y-2">
                    {sharedFromOthers.map((note) => (
                      <div
                        key={note.id}
                        className="bg-secondary/50 border border-border/50 rounded-lg p-3"
                      >
                        <p className="text-xs text-foreground whitespace-pre-wrap">
                          {note.content}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          — {note.user.name} •{" "}
                          {formatRelativeTime(note.updatedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* My notes */}
              {myNotes.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                    My Notes
                  </p>
                  <div className="space-y-2">
                    {myNotes.map((note) => (
                      <div
                        key={note.id}
                        className="bg-secondary/50 border border-border/50 rounded-lg p-3 group"
                      >
                        <p className="text-xs text-foreground whitespace-pre-wrap">
                          {note.content}
                        </p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-muted-foreground">
                            {formatRelativeTime(note.updatedAt)}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => toggleNoteShare(note)}
                              className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                                note.isShared
                                  ? "text-green-400 hover:text-muted-foreground"
                                  : "text-muted-foreground hover:text-green-400"
                              }`}
                              title={
                                note.isShared ? "Make private" : "Share with team"
                              }
                            >
                              {note.isShared ? "Shared" : "Share"}
                            </button>
                            <button
                              onClick={() => deleteNote(note.id)}
                              className="text-muted-foreground hover:text-destructive transition p-0.5"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {notes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No notes yet
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
