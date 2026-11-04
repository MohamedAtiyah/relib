import { z } from "zod";
import { keyConcepts } from "@/lib/agent/materials";
import { extractChunks, MATERIAL_TYPES } from "@/lib/extract";
import { MAX_FILE } from "@/lib/files";
import { liveMode } from "@/lib/model";
import { deleteObject, getObject } from "@/lib/r2";
import { userRoute } from "@/lib/route";
import { sql } from "@/lib/sql";
import { spend } from "@/lib/usage";

export const maxDuration = 60;

const Register = z.object({
  key: z.string().min(1).max(500),
  folderId: z.string().min(1).max(200),
  filename: z.string().min(1).max(300),
  mime: z.enum(Object.keys(MATERIAL_TYPES) as [keyof typeof MATERIAL_TYPES]),
});

const FILE_COLUMNS = ["id", "folderId", "filename", "mime", "kind", "size", "concepts", "createdAt"] as const;

export const GET = userRoute(120, async (req, userId) => {
  const folderId = new URL(req.url).searchParams.get("folderId") ?? "";
  const rows = await sql()`select ${sql()(FILE_COLUMNS)} from files where owner_id = ${userId} and folder_id = ${folderId} order by created_at`;
  return Response.json({ files: rows });
});

// After the browser puts a file in R2: check it is the user's own and the right size, read its text, record it.
export const POST = userRoute(30, async (req, userId) => {
  const parsed = Register.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const { key, folderId, filename, mime } = parsed.data;
  if (!key.startsWith(`${userId}/`)) return Response.json({ error: "not_found" }, { status: 404 });

  const res = await getObject(key);
  if (!res.ok) return Response.json({ error: "not_found" }, { status: 404 });
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_FILE) {
    await deleteObject(key);
    return Response.json({ error: "too_large" }, { status: 400 });
  }
  const kind = MATERIAL_TYPES[mime];
  let chunks: Awaited<ReturnType<typeof extractChunks>> = [];
  try {
    chunks = await extractChunks(kind, bytes);
  } catch {
    // a broken or encrypted file is still the user's; it just has no text to explain
  }

  let concepts: Awaited<ReturnType<typeof keyConcepts>> = [];
  if (chunks.length && liveMode() === "meta" && !(await spend({ userId, visitor: userId }))) {
    concepts = await keyConcepts(filename, chunks).catch(() => []);
  }

  const id = crypto.randomUUID();
  const file = { id, folderId, filename: filename.slice(0, 300), mime, kind, size: bytes.length, concepts, createdAt: Date.now() };
  const db = sql();
  await db.begin(async (tx) => {
    await tx`insert into files ${tx({ ...file, ownerId: userId, storageKey: key, concepts: tx.json(concepts) })}`;
    if (chunks.length) {
      await tx`insert into chunks ${tx(chunks.map((c, idx) => ({ ownerId: userId, fileId: id, idx, location: c.location, text: c.text.slice(0, 20000) })))}`;
    }
  });
  return Response.json({ file, pages: chunks.length });
});
