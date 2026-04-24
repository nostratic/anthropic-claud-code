import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roadmap = await prisma.roadmap.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      nodes: {
        include: {
          statusHistory: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { changedAt: "desc" },
            take: 10,
          },
          files: true,
          children: {
            select: { id: true, title: true, status: true, order: true, points: true },
          },
        },
        orderBy: { order: "asc" },
      },
      shares: {
        include: {
          sharedBy: { select: { id: true, name: true, email: true } },
          sharedTo: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!roadmap) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const participant = await prisma.conflictParticipant.findFirst({
    where: { conflictId: roadmap.conflictId, userId: session.user.id },
  });

  const isOwner = roadmap.createdById === session.user.id;
  const isSharedTo = roadmap.shares.some(
    (s) => s.sharedToId === session.user.id
  );

  if (!participant && !isOwner && !isSharedTo) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(roadmap);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roadmap = await prisma.roadmap.findUnique({ where: { id: params.id } });
  if (!roadmap || roadmap.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, type, isPersonal } = await req.json();

  const updated = await prisma.roadmap.update({
    where: { id: params.id },
    data: {
      ...(title && { title }),
      ...(type && { type }),
      ...(isPersonal !== undefined && { isPersonal }),
    },
  });

  return NextResponse.json(updated);
}
