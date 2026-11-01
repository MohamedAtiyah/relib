import type { z } from "zod";
import { DemoMiss } from "./model";

const hits = new Map<string, { count: number; resetAt: number }>();

// shortcut: counts per server instance, so the real limit is higher on Vercel; use a shared store if abused
function allow(key: string, perMinute: number) {
  const now = Date.now();
  const hit = hits.get(key);
  if (!hit || hit.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  return ++hit.count <= perMinute;
}

export function route<T>(schema: z.ZodType<T>, perMinute: number, run: (input: T) => Promise<unknown>) {
  return async (req: Request) => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
    if (!allow(`${new URL(req.url).pathname}:${ip}`, perMinute)) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    let input: T;
    try {
      input = schema.parse(await req.json());
    } catch {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }
    try {
      return Response.json(await run(input));
    } catch (err) {
      if (err instanceof DemoMiss) return Response.json({ error: "demo_miss" }, { status: 503 });
      console.error(req.url, err);
      return Response.json({ error: "upstream_failed" }, { status: 502 });
    }
  };
}
