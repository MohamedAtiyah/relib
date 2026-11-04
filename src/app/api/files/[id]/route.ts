import { deleteObject, presign } from "@/lib/r2";
import { userRoute } from "@/lib/route";
import { sql } from "@/lib/sql";

// Both lookups filter by the signed-in user, so another user's id is simply not found.
const own = async (userId: string, id: string) =>
  (await sql()`select storage_key from files where owner_id = ${userId} and id = ${id}`)[0] as { storageKey: string } | undefined;

// The owner check happens before signing; the link it hands out lasts 5 minutes.
export const GET = userRoute<{ id: string }>(120, async (_req, userId, { id }) => {
  const file = await own(userId, id);
  if (!file) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.redirect(await presign(file.storageKey, "GET", 300), 302);
});

export const DELETE = userRoute<{ id: string }>(60, async (_req, userId, { id }) => {
  const file = await own(userId, id);
  if (!file) return Response.json({ error: "not_found" }, { status: 404 });
  await deleteObject(file.storageKey);
  await sql().begin(async (tx) => {
    await tx`delete from chunks where owner_id = ${userId} and file_id = ${id}`;
    await tx`delete from files where owner_id = ${userId} and id = ${id}`;
  });
  return Response.json({ ok: true });
});
