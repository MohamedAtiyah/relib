import { del, get } from "@vercel/blob";
import { userRoute } from "@/lib/route";
import { sql } from "@/lib/sql";

// Both lookups filter by the signed-in user, so another user's id is simply not found.
const own = async (userId: string, id: string) =>
  (await sql()`select storage_key, filename from files where owner_id = ${userId} and id = ${id}`)[0];

export const GET = userRoute<{ id: string }>(120, async (_req, userId, { id }) => {
  const file = await own(userId, id);
  const blob = file && (await get(file.storageKey, { access: "private" }));
  if (blob?.statusCode !== 200) return Response.json({ error: "not_found" }, { status: 404 });
  return new Response(blob.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const DELETE = userRoute<{ id: string }>(60, async (_req, userId, { id }) => {
  const file = await own(userId, id);
  if (!file) return Response.json({ error: "not_found" }, { status: 404 });
  await del(file.storageKey);
  await sql().begin(async (tx) => {
    await tx`delete from suggestions where owner_id = ${userId} and source_id = ${id}`;
    await tx`delete from sources where owner_id = ${userId} and id = ${id}`;
    await tx`delete from files where owner_id = ${userId} and id = ${id}`;
  });
  return Response.json({ ok: true });
});
