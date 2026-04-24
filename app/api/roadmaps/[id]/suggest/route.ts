import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { suggestRoadmap } from "@/lib/anthropic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roadmap = await prisma.roadmap.findUnique({
    where: { id: params.id },
    include: { conflict: true },
  });
  if (!roadmap) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const participant = await prisma.conflictParticipant.findFirst({
    where: { conflictId: roadmap.conflictId, userId: session.user.id },
  });
  if (!participant && roadmap.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const suggestion = await suggestRoadmap(
      roadmap.conflict.title,
      roadmap.conflict.description
    );

    await prisma.roadmap.update({
      where: { id: params.id },
      data: { type: suggestion.type },
    });

    const createdNodes: { id: string; index: number }[] = [];
    for (let i = 0; i < suggestion.steps.length; i++) {
      const step = suggestion.steps[i];
      const parentId =
        step.parentIndex !== null && step.parentIndex !== undefined
          ? createdNodes[step.parentIndex]?.id ?? null
          : null;

      const node = await prisma.roadmapNode.create({
        data: {
          roadmapId: params.id,
          title: step.title,
          description: step.description,
          type: step.type,
          parentId,
          order: i,
          cost: step.cost,
          timeEstimate: step.timeEstimate,
          points: step.points,
          consequences: step.consequences,
          prerequisites: step.prerequisites,
          assumptions: step.assumptions,
          kpis: step.kpis,
        },
      });
      createdNodes.push({ id: node.id, index: i });
    }

    const updatedRoadmap = await prisma.roadmap.findUnique({
      where: { id: params.id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        nodes: {
          include: {
            statusHistory: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
            children: {
              select: { id: true, title: true, status: true, order: true, points: true },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(updatedRoadmap);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI suggestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
