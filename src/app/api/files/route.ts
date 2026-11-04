import { get } from "@vercel/blob";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { MAX_PDF } from "@/lib/files";
import { userRoute } from "@/lib/route";
import { sql } from "@/lib/sql";

export const maxDuration = 60;

const Register = z.object({
  pathname: z.string().min(1).max(500),
  folderId: z.string().min(1).max(200),
  filename: z.string().min(1).max(300),
});

// After the browser uploads to Blob: check the file is the user's own PDF, read its text, and record it.
export const POST = userRoute(30, async (req, userId) => {
  const parsed = Register.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const { pathname, folderId, filename } = parsed.data;
  if (!pathname.startsWith(`${userId}/`)) return Response.json({ error: "not_found" }, { status: 404 });

  const blob = await get(pathname, { access: "private", useCache: false });
  if (blob?.statusCode !== 200) return Response.json({ error: "not_found" }, { status: 404 });
  if (blob.blob.contentType !== "application/pdf" || blob.blob.size > MAX_PDF) {
    return Response.json({ error: "not_a_pdf" }, { status: 400 });
  }
  const bytes = new Uint8Array(await new Response(blob.stream).arrayBuffer());
  let text = "";
  try {
    text = (await extractText(await getDocumentProxy(bytes), { mergePages: true })).text.replace(/\s+/g, " ").trim();
  } catch {
    // a broken or encrypted PDF is still the user's file; it just has no text to check
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const source = {
    id,
    origin: "user" as const,
    title: filename.replace(/\.pdf$/i, "").slice(0, 1000),
    authors: [],
    url: `${new URL(req.url).origin}/api/files/${id}`,
    abstract: text.slice(0, 1500) || "No text could be read from this PDF. It may be a scanned image.",
    updatedAt: now,
  };
  const db = sql();
  await db.begin(async (tx) => {
    await tx`insert into files ${tx({ ownerId: userId, id, folderId, storageKey: pathname, filename: filename.slice(0, 300), mime: "application/pdf", size: blob.blob.size, createdAt: now })}`;
    await tx`insert into sources ${tx({ ...source, ownerId: userId, year: null, doi: null, fullText: text.slice(0, 500_000) || null })}`;
  });
  return Response.json({ source, hasText: Boolean(text) });
});
