import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateConflictSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conflicts = await prisma.conflict.findMany({
    where: {
      participants: { some: { userId: session.user.id } },
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      participants: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { roadmaps: true, notes: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(conflicts);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, description } = CreateConflictSchema.parse(body);

    const conflict = await prisma.conflict.create({
      data: {
        title,
        description,
        createdById: session.user.id,
        participants: {
          create: {
            userId: session.user.id,
            role: "admin",
          },
        },
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        participants: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    return NextResponse.json(conflict, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
