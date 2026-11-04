import { sql } from "./sql";

// Daily AI call caps, so the public demo cannot drain the credit.
export const CAPS = { visitor: 30, user: 300, global: 3000 };

const memory = new Map<string, number>();

const today = () => new Date().toISOString().slice(0, 10);

// Adds to today's count for a key and returns the new total (by = 0 just reads it).
export async function bump(key: string, day = today(), by = 1): Promise<number> {
  if (!process.env.DATABASE_URL) {
    // shortcut: per server instance; set DATABASE_URL so caps hold across instances
    const k = `${key}:${day}`;
    memory.set(k, (memory.get(k) ?? 0) + by);
    return memory.get(k)!;
  }
  const [row] = await sql()`
    insert into usage (key, day, count) values (${key}, ${day}, ${by})
    on conflict (key, day) do update set count = usage.count + ${by}
    returning count`;
  return row.count;
}

// Counts one call and says which cap, if any, it went over.
export async function spend(caller: { userId: string | null; visitor: string }): Promise<"visitor" | "global" | null> {
  const day = today();
  const mine = caller.userId ? await bump(`user:${caller.userId}`, day) : await bump(`visitor:${caller.visitor}`, day);
  if (mine > (caller.userId ? CAPS.user : CAPS.visitor)) return "visitor";
  if ((await bump("global", day)) > CAPS.global) return "global";
  return null;
}
