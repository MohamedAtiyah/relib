import type postgres from "postgres";
import { z } from "zod";
import { userRoute } from "@/lib/route";
import { FitGapSchema, PAGE_TYPES, SourceSchema } from "@/lib/schemas";
import { sql } from "@/lib/sql";

const id = z.string().min(1).max(200);
const time = z.number().finite().nonnegative();
const text = (max: number) => z.string().max(max);

// What a browser may write. owner_id always comes from the session, never from the body.
const ROWS = {
  folders: z.object({
    id,
    name: text(200),
    lastOpenedAt: time.optional(),
    createdAt: time,
    updatedAt: time,
  }),
  pages: z.object({
    id,
    folderId: id,
    type: z.enum(PAGE_TYPES),
    title: text(500),
    editorState: text(2_000_000),
    plainText: text(200_000),
    analysedText: text(200_000).optional(),
    lastOpenedAt: time.optional(),
    sourcesOn: z.boolean().optional(),
    research: z
      .object({ style: text(200), cover: z.array(z.object({ label: text(100), value: text(500) })).max(30), presetId: text(200).optional() })
      .optional(),
    createdAt: time,
    updatedAt: time,
  }),
  presets: z.object({
    id,
    folderId: id.optional(),
    name: text(200),
    fields: z.array(z.object({ label: text(100), value: text(500) })).max(30),
    citationStyle: text(50),
    sections: z.array(text(200)).max(40),
    updatedAt: time,
  }),
  // full_text is written only by the upload route, so it is not accepted here
  sources: SourceSchema.extend({ updatedAt: time }),
  suggestions: z.object({
    pageId: id,
    sourceId: id,
    folderId: id,
    fitGap: FitGapSchema,
    status: z.enum(["new", "accepted", "declined"]),
    addedBy: z.literal("you").optional(),
    createdAt: time,
    updatedAt: time,
  }),
};

type Table = keyof typeof ROWS;
const TABLES = Object.keys(ROWS) as Table[];

const PushBody = z.object(
  Object.fromEntries(TABLES.map((t) => [t, z.array(ROWS[t]).max(500).optional()])) as {
    [T in Table]: z.ZodOptional<z.ZodArray<(typeof ROWS)[T]>>;
  },
);

const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

export const GET = userRoute(60, async (_req, userId) => {
  const db = sql();
  await db`insert into users (id, created_at) values (${userId}, ${Date.now()}) on conflict do nothing`;
  const [folders, pages, presets, sources, suggestions] = await Promise.all([
    db`select id, name, last_opened_at, created_at, updated_at from folders where owner_id = ${userId}`,
    db`select id, folder_id, type, title, editor_state, plain_text, analysed_text, last_opened_at, sources_on, research, created_at, updated_at from pages where owner_id = ${userId}`,
    db`select id, folder_id, name, fields, citation_style, sections, updated_at from presets where owner_id = ${userId}`,
    db`select id, origin, title, authors, year, url, doi, abstract, venue, volume, issue, pages, entered, updated_at from sources where owner_id = ${userId}`,
    db`select page_id, source_id, folder_id, fit_gap, status, added_by, created_at, updated_at from suggestions where owner_id = ${userId}`,
  ]);
  return Response.json({ folders, pages, presets, sources, suggestions });
});

export const POST = userRoute(120, async (req, userId) => {
  const parsed = PushBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const db = sql();
  await db.begin(async (tx) => {
    for (const table of TABLES) {
      const rows = parsed.data[table];
      if (!rows?.length) continue;
      const cols = Object.keys(ROWS[table].shape);
      const values = rows.map((row) => {
        const out = { ...row, ownerId: userId } as Record<string, postgres.JSONValue>;
        if (table === "suggestions") {
          const s = row as z.infer<typeof ROWS.suggestions>;
          Object.assign(out, { id: `${s.pageId}:${s.sourceId}`, basis: s.fitGap.basedOn });
        }
        for (const c of cols) out[c] ??= null;
        return out;
      });
      const insertCols = [...new Set(["ownerId", "id", ...cols, ...(table === "suggestions" ? ["basis"] : [])])];
      // column names come from the whitelist above, never from the request
      const set = insertCols.filter((c) => c !== "ownerId" && c !== "id").map((c) => `${snake(c)} = excluded.${snake(c)}`).join(", ");
      await tx`
        insert into ${tx(table)} ${tx(values, insertCols)}
        on conflict (owner_id, id) do update set ${tx.unsafe(set)}
        where ${tx(table)}.updated_at <= excluded.updated_at`;
    }
  });
  return Response.json({ ok: true });
});
