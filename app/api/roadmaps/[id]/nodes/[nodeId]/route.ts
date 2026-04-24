import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; nodeId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const node = await prisma.roadmapNode.findUnique({
    where: { id: params.nodeId },
    include: { roadmap: true },
  });
  if (!node || node.roadmapId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const participant = await prisma.conflictParticipant.findFirst({
    where: { conflictId: node.roadmap.conflictId, userId: session.user.id },
  });
  if (!participant && node.roadmap.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    title,
    description,
    cost,
    timeEstimate,
    points,
    consequences,
    prerequisites,
    assumptions,
    kpis,
    positionX,
    positionY,
    order,
  } = body;

  const updated = await prisma.roadmapNode.update({
    where: { id: params.nodeId },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(cost !== undefined && { cost }),
      ...(timeEstimate !== undefined && { timeEstimate }),
      ...(points !== undefined && { points }),
      ...(consequences !== undefined && { consequences }),
      ...(prerequisites !== undefined && { prerequisites }),
      ...(assumptions !== undefined && { assumptions }),
      ...(kpis !== undefined && { kpis }),
      ...(positionX !== undefined && { positionX }),
      ...(positionY !== undefined && { positionY }),
      ...(order !== undefined && { order }),
    },
    include: {
      statusHistory: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { changedAt: "desc" },
      },
      files: true,
      children: {
        select: { id: true, title: true, status: true, order: true, points: true },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; nodeId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const node = await prisma.roadmapNode.findUnique({
    where: { id: params.nodeId },
    include: { roadmap: true },
  });
  if (!node || node.roadmapId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (node.roadmap.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.roadmapNode.delete({ where: { id: params.nodeId } });
  return NextResponse.json({ success: true });
}
