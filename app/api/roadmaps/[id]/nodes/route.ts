import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateNodeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(["step", "decision", "outcome"]).default("step"),
  parentId: z.string().optional().nullable(),
  order: z.number().int().default(0),
  cost: z.number().optional().nullable(),
  timeEstimate: z.string().optional().nullable(),
  points: z.number().int().min(0).max(100).default(10),
  consequences: z.string().optional().nullable(),
  prerequisites: z.string().optional().nullable(),
  assumptions: z.string().optional().nullable(),
  kpis: z.string().optional().nullable(),
});

export async function POST(
  req: Request,
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
  if (!participant && roadmap.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = CreateNodeSchema.parse(body);

    const node = await prisma.roadmapNode.create({
      data: { roadmapId: params.id, ...data },
      include: {
        statusHistory: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        children: {
          select: { id: true, title: true, status: true, order: true, points: true },
        },
      },
    });

    return NextResponse.json(node, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
