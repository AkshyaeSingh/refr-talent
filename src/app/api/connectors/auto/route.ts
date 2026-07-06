import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ingestRows } from "@/lib/ingest";
import { autoMapColumns } from "@/lib/ai";
import {
  fetchAirtableRows,
  fetchTypeformRows,
  type AirtableConfig,
  type TypeformConfig,
} from "@/lib/connectorSync";
import type { Prisma } from "@/generated/prisma/client";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("AIRTABLE"),
    label: z.string().min(1),
    token: z.string().min(1),
    baseId: z.string().min(1),
    tableId: z.string().min(1),
  }),
  z.object({
    type: z.literal("TYPEFORM"),
    label: z.string().min(1),
    token: z.string().min(1),
    formId: z.string().min(1),
  }),
]);

// One-click connect: fetch rows, AI-map columns, store the connector with that
// mapping, and ingest — no manual column mapping. Re-syncs reuse the mapping.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const input = parsed.data;

  try {
    let rows: Record<string, string>[];
    if (input.type === "AIRTABLE") {
      rows = await fetchAirtableRows({
        token: input.token,
        baseId: input.baseId,
        tableId: input.tableId,
        fieldMapping: {},
      } as AirtableConfig);
    } else {
      rows = await fetchTypeformRows({
        token: input.token,
        formId: input.formId,
        fieldMapping: {},
      } as TypeformConfig);
    }

    const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    if (headers.length === 0) {
      return NextResponse.json({ error: "Source returned no columns." }, { status: 400 });
    }
    const { mapping, includeColumns } = await autoMapColumns(headers, rows.slice(0, 4));

    const config =
      input.type === "AIRTABLE"
        ? {
            token: input.token,
            baseId: input.baseId,
            tableId: input.tableId,
            fieldMapping: mapping,
            includeColumns,
          }
        : {
            token: input.token,
            formId: input.formId,
            fieldMapping: mapping,
            includeColumns,
          };

    const connector = await prisma.connector.create({
      data: {
        orgId: user.orgId,
        type: input.type,
        label: input.label,
        config: config as Prisma.InputJsonValue,
        status: "ACTIVE",
        lastSyncedAt: new Date(),
      },
    });

    const { created, updated } = await ingestRows(
      user.orgId,
      rows,
      mapping,
      input.label,
      includeColumns
    );

    return NextResponse.json({
      ok: true,
      connectorId: connector.id,
      created,
      updated,
      fetched: rows.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not connect.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
