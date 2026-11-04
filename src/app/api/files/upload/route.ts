import { z } from "zod";
import { MATERIAL_TYPES } from "@/lib/extract";
import { MAX_FILE } from "@/lib/files";
import { presign, r2Ready } from "@/lib/r2";
import { userRoute } from "@/lib/route";

const Body = z.object({
  filename: z.string().min(1).max(300),
  size: z.number().int().positive().max(MAX_FILE),
  mime: z.enum(Object.keys(MATERIAL_TYPES) as [keyof typeof MATERIAL_TYPES]),
});

// Hands the browser a 10-minute URL to put one file under the user's own prefix.
export const POST = userRoute(30, async (req, userId) => {
  if (!r2Ready()) return Response.json({ error: "storage_off" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const safe = parsed.data.filename.replace(/[^\w.-]+/g, "_").slice(-120);
  const key = `${userId}/${crypto.randomUUID()}-${safe}`;
  return Response.json({ key, url: await presign(key, "PUT") });
});
