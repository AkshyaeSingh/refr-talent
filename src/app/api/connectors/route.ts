import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const connectors = await prisma.connector.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: "desc" },
  });

  // Never leak stored tokens to the client.
  const safe = connectors.map((c) => {
    const config = (c.config ?? {}) as Record<string, unknown>;
    const { token: _token, ...rest } = config;
    void _token;
    return { ...c, config: rest, hasToken: Boolean(config.token) };
  });

  return NextResponse.json({ connectors: safe });
}

const fieldMapping = z.record(z.string(), z.string());

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("AIRTABLE"),
    label: z.string().min(1),
    token: z.string().min(1),
    baseId: z.string().min(1),
    tableId: z.string().min(1),
    fieldMapping,
    includeColumns: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("TYPEFORM"),
    label: z.string().min(1),
    token: z.string().min(1),
    formId: z.string().min(1),
    fieldMapping,
    includeColumns: z.array(z.string()).optional(),
  }),
]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const { type, label, ...rest } = parsed.data;

  const connector = await prisma.connector.create({
    data: {
      orgId: user.orgId,
      type,
      label,
      config: rest as Prisma.InputJsonValue,
      status: "NEVER_SYNCED",
    },
  });

  return NextResponse.json({ connector: { ...connector, config: undefined } });
}
