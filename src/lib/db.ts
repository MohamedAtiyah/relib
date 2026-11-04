import Dexie, { type DBCore, type Table } from "dexie";
import type { Folder, Page, Preset, Source, Suggestion } from "./schemas";

export const SYNCED = ["folders", "pages", "presets", "sources", "suggestions"] as const;
export type SyncedTable = (typeof SYNCED)[number];

export class RelibDB extends Dexie {
  folders!: Table<Folder, string>;
  pages!: Table<Page, string>;
  presets!: Table<Preset, string>;
  sources!: Table<Source & { updatedAt?: number }, string>;
  suggestions!: Table<Suggestion, [string, string]>;
  cache!: Table<{ key: string; value: unknown }, string>;

  constructor(name: string, onWrite?: (table: SyncedTable, rows: object[]) => void) {
    super(name);
    this.version(1).stores({
      folders: "id",
      pages: "id, folderId",
      sources: "id",
      suggestions: "[pageId+sourceId], folderId, pageId",
      cache: "key",
    });
    this.version(2).stores({ presets: "id" });
    if (onWrite) this.use(syncMiddleware(onWrite));
  }
}

// Rows written while applying a pull carry this flag on their transaction, so they are not pushed back.
export const FROM_SERVER = Symbol("fromServer");

function syncMiddleware(onWrite: (table: SyncedTable, rows: object[]) => void) {
  return {
    stack: "dbcore" as const,
    name: "sync",
    create: (down: DBCore): DBCore => ({
      ...down,
      table(name) {
        const table = down.table(name);
        if (!(SYNCED as readonly string[]).includes(name)) return table;
        return {
          ...table,
          async mutate(req) {
            const remote = (req.trans as unknown as Record<symbol, boolean>)[FROM_SERVER];
            if (remote || (req.type !== "put" && req.type !== "add")) return table.mutate(req);
            // shortcut: deletes are not synced; nothing in the app deletes yet
            const now = Date.now();
            const values = req.values.map((v) => ({ ...v, updatedAt: now }));
            const res = await table.mutate({ ...req, values });
            onWrite(name as SyncedTable, values);
            return res;
          },
        };
      },
    }),
  };
}

// The open workspace: "relib-demo" for the demo, "relib-<clerk user id>" for an account.
// Modules read it through this live binding; Workspace opens it before rendering anything that queries.
export let db = new RelibDB("relib-demo");

export function openWorkspace(name: string, onWrite?: (table: SyncedTable, rows: object[]) => void) {
  if (db.name !== name) {
    db.close();
    db = new RelibDB(name, onWrite);
  }
  return db;
}

export async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function cached<T>(input: unknown, run: () => Promise<T>): Promise<T> {
  const key = await sha256(JSON.stringify(input));
  const hit = await db.cache.get(key);
  if (hit) return hit.value as T;
  const value = await run();
  await db.cache.put({ key, value });
  return value;
}

export async function ensureSeed() {
  if (await db.folders.count()) return;
  const seed = (await import("../../seed/economics.json")).default as unknown as {
    folders: Folder[];
    pages: Page[];
    presets: Preset[];
    sources: Source[];
    suggestions: Suggestion[];
    trees: Record<string, unknown>;
  };
  // the seed is a fixed past; shift it so "since your last visit" always has something to say
  const shift = Date.now() - Math.max(...seed.suggestions.map((s) => s.createdAt ?? 0));
  const move = <T extends { createdAt?: number; updatedAt?: number; lastOpenedAt?: number }>(row: T): T => ({
    ...row,
    ...(row.createdAt && { createdAt: row.createdAt + shift }),
    ...(row.updatedAt && { updatedAt: row.updatedAt + shift }),
    ...(row.lastOpenedAt && { lastOpenedAt: row.lastOpenedAt + shift }),
  });
  await db.transaction("rw", [db.folders, db.pages, db.presets, db.sources, db.suggestions, db.cache], async () => {
    await db.folders.bulkPut(seed.folders.map(move));
    await db.pages.bulkPut(seed.pages.map(move));
    await db.presets.bulkPut(seed.presets);
    await db.sources.bulkPut(seed.sources);
    await db.suggestions.bulkPut(seed.suggestions.map(move));
    await db.cache.bulkPut(Object.entries(seed.trees).map(([folderId, value]) => ({ key: treeKey(folderId), value })));
  });
}

export async function createPage(folderId: string) {
  const id = crypto.randomUUID();
  await db.pages.add({ id, folderId, title: "", editorState: "", plainText: "", createdAt: Date.now(), updatedAt: Date.now() });
  return id;
}

export async function createFolder(name: string, kind: Folder["kind"] = "study", agentRole = "Tutor") {
  const id = crypto.randomUUID();
  await db.folders.add({ id, name, kind, agentRole, lastOpenedAt: Date.now(), createdAt: Date.now() });
  return createPage(id);
}

export const DEFAULT_PRESET: Preset = {
  id: "default",
  name: "University report",
  fields: [
    { label: "Title", value: "" },
    { label: "Author", value: "" },
    { label: "Course", value: "" },
    { label: "Date", value: "" },
  ],
  citationStyle: "APA 7",
  sections: ["Abstract", "Introduction", "Literature review", "Method", "Findings", "Discussion", "References"],
};

export const treeKey = (folderId: string) => `tree:${folderId}`;
