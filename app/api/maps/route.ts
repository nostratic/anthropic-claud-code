import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countNodesInJSON } from "@/lib/mindmap/server";
import { getTemplate } from "@/lib/mindmap/templates";
import { sanitizeMap } from "@/lib/mindmap/model";

const CreateSchema = z.object({
  title: z.string().trim().max(200).optional(),
  template: z.string().optional(),
  // Optional imported map (JSON tree)
  data: z.unknown().optional(),
  theme: z.string().max(40).optional(),
  layout: z.enum(["mindmap", "right", "left", "org"]).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const maps = await prisma.mindMap.findMany({
    where: { OR: [{ ownerId: userId }, { collaborators: { some: { userId } } }] },
    select: {
      id: true,
      title: true,
      theme: true,
      data: true,
      createdAt: true,
      updatedAt: true,
      ownerId: true,
      owner: { select: { id: true, name: true } },
      collaborators: { where: { userId }, select: { role: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(
    maps.map((m) => ({
      id: m.id,
      title: m.title,
      theme: m.theme,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      owner: m.owner,
      nodeCount: countNodesInJSON(m.data),
      role: m.ownerId === userId ? "owner" : m.collaborators[0]?.role === "viewer" ? "viewer" : "editor",
    }))
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await req.json().catch(() => ({})));
  } catch (err) {
    return NextResponse.json({ error: (err as z.ZodError).errors }, { status: 400 });
  }

  const tpl = getTemplate(body.template);
  let data = body.data !== undefined ? sanitizeMap(body.data) : tpl.build();
  if (!data) return NextResponse.json({ error: "Invalid map data" }, { status: 400 });
  if (body.title && body.data === undefined && tpl.id === "blank") {
    data = { ...data, nodes: { ...data.nodes, [data.rootId]: { ...data.nodes[data.rootId], text: body.title } } };
  }
  const title = body.title || data.nodes[data.rootId].text || "Untitled map";

  const map = await prisma.mindMap.create({
    data: {
      title,
      data: JSON.stringify(data),
      theme: body.theme ?? tpl.theme,
      layout: body.layout ?? tpl.layout,
      ownerId: session.user.id,
    },
    select: { id: true },
  });
  return NextResponse.json(map, { status: 201 });
}
