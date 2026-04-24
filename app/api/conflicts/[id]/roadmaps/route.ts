import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateRoadmapSchema = z.object({
  title: z.string().min(3).max(200),
  type: z.enum(["linear", "multipath"]).default("linear"),
  isPersonal: z.boolean().default(false),
});

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const participant = await prisma.conflictParticipant.findFirst({
    where: { conflictId: params.id, userId: session.user.id },
  });
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roadmaps = await prisma.roadmap.findMany({
    where: {
      conflictId: params.id,
      OR: [
        { isPersonal: false },
        { createdById: session.user.id },
        {
          shares: {
            some: {
              sharedToId: session.user.id,
              status: { in: ["accepted", "pending"] },
            },
          },
        },
      ],
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { nodes: true } },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(roadmaps);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const participant = await prisma.conflictParticipant.findFirst({
    where: { conflictId: params.id, userId: session.user.id },
  });
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, type, isPersonal } = CreateRoadmapSchema.parse(body);

    const roadmap = await prisma.roadmap.create({
      data: {
        conflictId: params.id,
        createdById: session.user.id,
        title,
        type,
        isPersonal,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { nodes: true } },
      },
    });

    return NextResponse.json(roadmap, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
