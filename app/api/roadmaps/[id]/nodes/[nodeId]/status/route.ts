import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const StatusUpdateSchema = z.object({
  status: z.enum([
    "pending",
    "in_progress",
    "completed",
    "stuck",
    "blocked",
    "skipped",
  ]),
  comment: z.string().optional(),
});

export async function POST(
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

  try {
    const body = await req.json();
    const { status, comment } = StatusUpdateSchema.parse(body);

    const oldStatus = node.status;

    const [history, updated] = await prisma.$transaction([
      prisma.nodeStatusHistory.create({
        data: {
          nodeId: params.nodeId,
          userId: session.user.id,
          oldStatus,
          newStatus: status,
          comment,
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.roadmapNode.update({
        where: { id: params.nodeId },
        data: { status },
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
      }),
    ]);

    return NextResponse.json({ node: updated, history });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
