import { db, FROM_SERVER, SYNCED, type SyncedTable } from "./db";

// Last write wins by updatedAt. The browser keeps a copy for speed; Neon is the record.

type Row = Record<string, unknown> & { updatedAt?: number };
export type SyncStatus = "saved" | "saving" | "offline";

const keyOf = (table: SyncedTable, row: Row) =>
  table === "suggestions" ? `${row.pageId}:${row.sourceId}` : String(row.id);

const queue = Object.fromEntries(SYNCED.map((t) => [t, new Map<string, Row>()])) as Record<SyncedTable, Map<string, Row>>;
const BATCH = 500; // the server's per-table limit per request
let timer: ReturnType<typeof setTimeout> | undefined;
let listener: ((status: SyncStatus) => void) | undefined;

export const onSyncStatus = (fn: (status: SyncStatus) => void) => (listener = fn);

export function queueRows(table: SyncedTable, rows: object[]) {
  for (const row of rows as Row[]) queue[table].set(keyOf(table, row), row);
  listener?.("saving");
  clearTimeout(timer);
  timer = setTimeout(flush, 1000);
}

export async function flush(keepalive = false) {
  clearTimeout(timer);
  const body: Partial<Record<SyncedTable, Row[]>> = {};
  for (const t of SYNCED) {
    const rows = [...queue[t]].slice(0, BATCH);
    if (!rows.length) continue;
    body[t] = rows.map(([, row]) => row);
    for (const [key] of rows) queue[t].delete(key);
  }
  if (!Object.keys(body).length) return;
  try {
    // shortcut: a keepalive body over 64 KB fails, so a big unsaved edit can be lost on tab close; the debounce makes that rare
    const res = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive });
    if (!res.ok) throw new Error(`sync ${res.status}`);
  } catch {
    // put rows back unless a newer write for the same row is already queued
    for (const t of SYNCED) for (const row of body[t] ?? []) if (!queue[t].has(keyOf(t, row))) queue[t].set(keyOf(t, row), row);
    listener?.("offline");
    timer = setTimeout(flush, 10_000);
    return;
  }
  if (SYNCED.some((t) => queue[t].size)) return flush();
  listener?.("saved");
}

const dropNulls = (row: Row) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) as Row;

export async function pull() {
  const res = await fetch("/api/sync");
  if (!res.ok) throw new Error(`sync ${res.status}`);
  const server = (await res.json()) as Record<SyncedTable, Row[]>;
  const toPush: [SyncedTable, Row[]][] = [];
  await db.transaction("rw", SYNCED.map((t) => db.table(t)), async (tx) => {
    (tx.idbtrans as unknown as Record<symbol, boolean>)[FROM_SERVER] = true;
    for (const t of SYNCED) {
      const local = new Map(((await db.table(t).toArray()) as Row[]).map((r) => [keyOf(t, r), r]));
      const fresh: Row[] = [];
      for (const row of server[t].map(dropNulls)) {
        const mine = local.get(keyOf(t, row));
        local.delete(keyOf(t, row));
        if (!mine || (mine.updatedAt ?? 0) < (row.updatedAt ?? 0)) fresh.push(row);
        else if ((mine.updatedAt ?? 0) > (row.updatedAt ?? 0)) local.set(keyOf(t, row), mine);
      }
      await db.table(t).bulkPut(fresh);
      // what is left is newer here or missing on the server, e.g. an edit made while offline
      if (local.size) toPush.push([t, [...local.values()]]);
    }
  });
  for (const [t, rows] of toPush) queueRows(t, rows);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => flush(true));
}
