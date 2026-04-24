import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
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

  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({ where: { email } });
  if (!targetUser) {
    return NextResponse.json(
      { error: "User not found with that email" },
      { status: 404 }
    );
  }

  if (targetUser.id === session.user.id) {
    return NextResponse.json(
      { error: "Cannot share with yourself" },
      { status: 400 }
    );
  }

  const existing = await prisma.roadmapShare.findUnique({
    where: { roadmapId_sharedToId: { roadmapId: params.id, sharedToId: targetUser.id } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Already shared with this user" },
      { status: 409 }
    );
  }

  const share = await prisma.roadmapShare.create({
    data: {
      roadmapId: params.id,
      sharedById: session.user.id,
      sharedToId: targetUser.id,
    },
    include: {
      sharedBy: { select: { id: true, name: true, email: true } },
      sharedTo: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(share, { status: 201 });
}
