import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMapRole } from "@/lib/mindmap/server";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getMapRole(params.id, session.user.id);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const src = await prisma.mindMap.findUnique({ where: { id: params.id } });
  if (!src) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const copy = await prisma.mindMap.create({
    data: {
      title: `${src.title} (copy)`.slice(0, 200),
      data: src.data,
      theme: src.theme,
      layout: src.layout,
      ownerId: session.user.id,
    },
    select: { id: true },
  });
  return NextResponse.json(copy, { status: 201 });
}
