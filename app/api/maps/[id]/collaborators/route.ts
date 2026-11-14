import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMapRole } from "@/lib/mindmap/server";

const AddSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["editor", "viewer"]).default("editor"),
});
const RemoveSchema = z.object({ userId: z.string() });

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getMapRole(params.id, session.user.id);
  if (role !== "owner") return NextResponse.json({ error: "Only the owner can share" }, { status: 403 });

  const parsed = AddSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });

  const user =
    (await prisma.user.findUnique({ where: { email: parsed.data.email } })) ??
    (await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } }));
  if (!user) {
    return NextResponse.json({ error: "No account exists with that email" }, { status: 404 });
  }
  if (user.id === session.user.id) {
    return NextResponse.json({ error: "You already own this map" }, { status: 400 });
  }

  const collab = await prisma.mindMapCollaborator.upsert({
    where: { mapId_userId: { mapId: params.id, userId: user.id } },
    create: { mapId: params.id, userId: user.id, role: parsed.data.role },
    update: { role: parsed.data.role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(collab, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getMapRole(params.id, session.user.id);
  if (role !== "owner") return NextResponse.json({ error: "Only the owner can manage sharing" }, { status: 403 });

  const parsed = RemoveSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await prisma.mindMapCollaborator.deleteMany({
    where: { mapId: params.id, userId: parsed.data.userId },
  });
  return NextResponse.json({ ok: true });
}
