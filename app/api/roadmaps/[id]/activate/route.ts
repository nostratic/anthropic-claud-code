import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roadmap = await prisma.roadmap.findUnique({ where: { id: params.id } });
  if (!roadmap) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const participant = await prisma.conflictParticipant.findFirst({
    where: { conflictId: roadmap.conflictId, userId: session.user.id },
  });
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.roadmap.updateMany({
      where: { conflictId: roadmap.conflictId, isActive: true },
      data: { isActive: false },
    }),
    prisma.roadmap.update({
      where: { id: params.id },
      data: { isActive: true, status: "active" },
    }),
  ]);

  const updated = await prisma.roadmap.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { nodes: true } },
    },
  });

  return NextResponse.json(updated);
}
