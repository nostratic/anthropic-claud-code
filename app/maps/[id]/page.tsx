"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { MindMapEditor } from "@/components/mindmap/MindMapEditor";
import type { MindMapRecord } from "@/lib/mindmap/types";
import { sanitizeMap } from "@/lib/mindmap/model";

export default function MapEditorPage({ params }: { params: { id: string } }) {
  const [map, setMap] = useState<MindMapRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/maps/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "This map doesn't exist or you don't have access." : "Could not load map.");
        return r.json();
      })
      .then((m) => {
        const data = sanitizeMap(m.data);
        if (!data) throw new Error("This map's data is corrupted.");
        setMap({ ...m, data });
        document.title = `${m.title} – Mind Maps`;
      })
      .catch((e: Error) => setError(e.message));
  }, [params.id]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p>{error}</p>
        <Link href="/maps" className="text-primary hover:underline">Back to my maps</Link>
      </div>
    );
  }
  if (!map) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }
  return <MindMapEditor initial={map} />;
}
