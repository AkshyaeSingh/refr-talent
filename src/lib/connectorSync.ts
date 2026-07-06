import type { FieldMapping } from "@/lib/candidateFields";

export type AirtableConfig = {
  token: string;
  baseId: string;
  tableId: string;
  fieldMapping: FieldMapping;
};

export type TypeformConfig = {
  token: string;
  formId: string;
  fieldMapping: FieldMapping;
};

// Fetches all rows from an Airtable table (following pagination) and returns
// them as plain string maps keyed by Airtable field name.
export async function fetchAirtableRows(config: AirtableConfig): Promise<Record<string, string>[]> {
  const rows: Record<string, string>[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${config.baseId}/${config.tableId}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      records: { fields: Record<string, unknown> }[];
      offset?: string;
    };
    for (const rec of data.records) {
      const row: Record<string, string> = {};
      for (const [k, v] of Object.entries(rec.fields)) {
        row[k] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
      }
      rows.push(row);
    }
    offset = data.offset;
  } while (offset);

  return rows;
}

// Fetches Typeform responses and flattens each into a string map keyed by the
// question title, so the same field-mapping UI applies.
export async function fetchTypeformRows(config: TypeformConfig): Promise<Record<string, string>[]> {
  const res = await fetch(
    `https://api.typeform.com/forms/${config.formId}/responses?page_size=1000`,
    { headers: { Authorization: `Bearer ${config.token}` } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Typeform ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    items: {
      answers?: {
        field: { id: string; ref?: string; title?: string };
        type: string;
        [k: string]: unknown;
      }[];
    }[];
  };

  return (data.items ?? []).map((item) => {
    const row: Record<string, string> = {};
    for (const ans of item.answers ?? []) {
      const key = ans.field.title || ans.field.ref || ans.field.id;
      const value =
        (ans as Record<string, unknown>)[ans.type] ??
        (ans as Record<string, unknown>).text ??
        "";
      if (typeof value === "object" && value !== null) {
        // choice/choices objects
        const v = value as { label?: string; labels?: string[] };
        row[key] = v.label ?? v.labels?.join(", ") ?? JSON.stringify(value);
      } else {
        row[key] = String(value);
      }
    }
    return row;
  });
}
