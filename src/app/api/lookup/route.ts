import { z } from "zod";
import { route } from "@/lib/route";
import { lookupRef } from "@/lib/sources";

export const POST = route(z.object({ ref: z.string().min(1).max(500) }), 20, async ({ ref }) => ({ source: await lookupRef(ref) }), false);
