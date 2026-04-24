import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shares = await prisma.roadmapShare.findMany({
    where: { sharedToId: session.user.id, status: "pending" },
    include: {
      sharedBy: { select: { id: true, name: true, email: true } },
      roadmap: {
        include: {
          conflict: { select: { id: true, title: true } },
          _count: { select: { nodes: true } },
        },
      },
    },
    orderBy: { sharedAt: "desc" },
  });

  return NextResponse.json(shares);
}
