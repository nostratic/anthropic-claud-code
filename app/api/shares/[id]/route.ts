import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const share = await prisma.roadmapShare.findUnique({
    where: { id: params.id },
    include: { roadmap: true },
  });

  if (!share || share.sharedToId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status } = await req.json();
  if (!["accepted", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await prisma.roadmapShare.update({
    where: { id: params.id },
    data: { status },
    include: {
      roadmap: {
        include: { conflict: { select: { id: true, title: true } } },
      },
      sharedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (status === "accepted") {
    await prisma.$transaction([
      prisma.roadmap.updateMany({
        where: { conflictId: share.roadmap.conflictId, isActive: true },
        data: { isActive: false },
      }),
      prisma.roadmap.update({
        where: { id: share.roadmapId },
        data: { isActive: true, status: "active" },
      }),
    ]);
  }

  return NextResponse.json(updated);
}
