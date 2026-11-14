import { prisma } from "@/lib/prisma";

export type MapRole = "owner" | "editor" | "viewer";

/** Returns the caller's role on a map, or null if they have no access. */
export async function getMapRole(mapId: string, userId: string): Promise<MapRole | null> {
  const map = await prisma.mindMap.findUnique({
    where: { id: mapId },
    select: { ownerId: true, collaborators: { where: { userId }, select: { role: true } } },
  });
  if (!map) return null;
  if (map.ownerId === userId) return "owner";
  const c = map.collaborators[0];
  if (!c) return null;
  return c.role === "viewer" ? "viewer" : "editor";
}

export function countNodesInJSON(data: string): number {
  try {
    const parsed = JSON.parse(data) as { nodes?: Record<string, unknown> };
    return Object.keys(parsed.nodes ?? {}).length;
  } catch {
    return 0;
  }
}
