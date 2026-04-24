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

  const admin = await prisma.conflictParticipant.findFirst({
    where: { conflictId: params.id, userId: session.user.id },
  });
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const userToAdd = await prisma.user.findUnique({ where: { email } });
  if (!userToAdd) {
    return NextResponse.json(
      { error: "User not found with that email" },
      { status: 404 }
    );
  }

  const existing = await prisma.conflictParticipant.findFirst({
    where: { conflictId: params.id, userId: userToAdd.id },
  });
  if (existing) {
    return NextResponse.json(
      { error: "User is already a participant" },
      { status: 409 }
    );
  }

  const participant = await prisma.conflictParticipant.create({
    data: {
      conflictId: params.id,
      userId: userToAdd.id,
      role: "member",
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(participant, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await req.json();

  const admin = await prisma.conflictParticipant.findFirst({
    where: { conflictId: params.id, userId: session.user.id, role: "admin" },
  });
  if (!admin && userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.conflictParticipant.deleteMany({
    where: { conflictId: params.id, userId },
  });

  return NextResponse.json({ success: true });
}
