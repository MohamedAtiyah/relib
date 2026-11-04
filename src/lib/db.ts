import Dexie, { type DBCore, type Table } from "dexie";
import type { Folder, Page, PageType, Preset, Source, Suggestion } from "./schemas";
import { START_HERE } from "./starthere";

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

export async function createPage(folderId: string, type: PageType = "notes", title = "", editorState = "", plainText = "") {
  const id = crypto.randomUUID();
  await db.pages.add({ id, folderId, type, title, editorState, plainText, createdAt: Date.now(), updatedAt: Date.now() });
  return id;
}

export async function createFolder(name: string) {
  const id = crypto.randomUUID();
  await db.folders.add({ id, name, lastOpenedAt: Date.now(), createdAt: Date.now() });
  return id;
}

// A new workspace (account or demo) starts with one folder holding the Start here page.
export async function createStarter() {
  const folderId = await createFolder("Getting started");
  const id = await createPage(folderId, "notes", START_HERE.title, START_HERE.editorState, START_HERE.plainText);
  // marked as read, so opening the guide never spends a visitor's AI calls
  await db.pages.update(id, { analysedText: `${START_HERE.title}\n${START_HERE.plainText}` });
  return id;
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
