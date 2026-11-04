import { auth } from "@clerk/nextjs/server";
import type { z } from "zod";
import { clerkEnabled } from "./clerk";
import { AiOff, liveMode, type ModelMode } from "./model";
import { spend } from "./usage";

const hits = new Map<string, { count: number; resetAt: number }>();

// shortcut: counts per server instance, so the real limit is higher on Vercel; use a shared store if abused
export function allow(key: string, perMinute: number) {
  const now = Date.now();
  const hit = hits.get(key);
  if (!hit || hit.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  return ++hit.count <= perMinute;
}

const currentUser = async () => (clerkEnabled ? (await auth()).userId : null);

export async function caller(): Promise<{ userId: string | null; mode: ModelMode }> {
  return { userId: await currentUser(), mode: liveMode() };
}

const clientKey = (req: Request, userId: string | null) =>
  userId ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";

// metered: the route spends model calls, so it counts against the daily caps
export function route<T>(
  schema: z.ZodType<T>,
  perMinute: number,
  run: (input: T, userId: string | null) => Promise<unknown>,
  metered = true,
) {
  return async (req: Request) => {
    const userId = await currentUser();
    const visitor = clientKey(req, userId);
    if (!allow(`${new URL(req.url).pathname}:${visitor}`, perMinute)) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    let input: T;
    try {
      input = schema.parse(await req.json());
    } catch {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }
    try {
      const over = metered && liveMode() === "meta" ? await spend({ userId, visitor }) : null;
      if (over) return Response.json({ error: over === "global" ? "global_cap" : "daily_cap" }, { status: 429 });
      return Response.json(await run(input, userId));
    } catch (err) {
      if (err instanceof AiOff) return Response.json({ error: "ai_off" }, { status: 503 });
      console.error(req.url, err);
      return Response.json({ error: "upstream_failed" }, { status: 502 });
    }
  };
}

// For routes that read or write one user's data: no user, no access.
export function userRoute<P>(perMinute: number, run: (req: Request, userId: string, params: P) => Promise<Response>) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    const userId = await currentUser();
    if (!userId) return Response.json({ error: "signed_out" }, { status: 401 });
    if (!allow(`${new URL(req.url).pathname}:${userId}`, perMinute)) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    try {
      return await run(req, userId, await ctx.params);
    } catch (err) {
      console.error(req.url, err);
      return Response.json({ error: "server_failed" }, { status: 500 });
    }
  };
}
