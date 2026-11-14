import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMapRole } from "@/lib/mindmap/server";
import { sanitizeMap } from "@/lib/mindmap/model";

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  theme: z.string().max(40).optional(),
  layout: z.enum(["mindmap", "right", "left", "org"]).optional(),
  data: z.unknown().optional(),
  /** Version the client's edits are based on; used to detect concurrent edits. */
  baseVersion: z.number().int().optional(),
});

type Params = { params: { id: string } };

export async function GET(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getMapRole(params.id, session.user.id);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cheap polling endpoint used by the editor to detect collaborators' saves.
  if (new URL(req.url).searchParams.get("versionOnly")) {
    const v = await prisma.mindMap.findUnique({ where: { id: params.id }, select: { version: true } });
    return NextResponse.json({ version: v?.version ?? 0 });
  }

  const map = await prisma.mindMap.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      collaborators: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!map) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ...map, data: JSON.parse(map.data), role });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getMapRole(params.id, session.user.id);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "viewer") return NextResponse.json({ error: "Read-only access" }, { status: 403 });

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: (err as z.ZodError).errors ?? "Bad request" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.theme !== undefined) update.theme = body.theme;
  if (body.layout !== undefined) update.layout = body.layout;
  if (body.data !== undefined) {
    const clean = sanitizeMap(body.data);
    if (!clean) return NextResponse.json({ error: "Invalid map data" }, { status: 400 });
    update.data = JSON.stringify(clean);
  }

  // Optimistic concurrency: only apply if nobody saved in between.
  const where =
    body.baseVersion !== undefined
      ? { id: params.id, version: body.baseVersion }
      : { id: params.id };
  const result = await prisma.mindMap.updateMany({
    where,
    data: { ...update, version: { increment: 1 } },
  });
  if (result.count === 0) {
    const current = await prisma.mindMap.findUnique({
      where: { id: params.id },
      select: { version: true },
    });
    return NextResponse.json(
      { error: "This map was changed by someone else", version: current?.version },
      { status: 409 }
    );
  }
  const saved = await prisma.mindMap.findUnique({
    where: { id: params.id },
    select: { version: true, updatedAt: true },
  });
  return NextResponse.json(saved);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getMapRole(params.id, session.user.id);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (role === "owner") {
    await prisma.mindMap.delete({ where: { id: params.id } });
  } else {
    // Collaborators "delete" by leaving the map.
    await prisma.mindMapCollaborator.deleteMany({
      where: { mapId: params.id, userId: session.user.id },
    });
  }
  return NextResponse.json({ ok: true });
}
