import Dexie, { type Table } from "dexie";
import type { Folder, Page, Source, Suggestion } from "./schemas";

class RelibDB extends Dexie {
  folders!: Table<Folder, string>;
  pages!: Table<Page, string>;
  sources!: Table<Source, string>;
  suggestions!: Table<Suggestion, [string, string]>;
  cache!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("relib");
    this.version(1).stores({
      folders: "id",
      pages: "id, folderId",
      sources: "id",
      suggestions: "[pageId+sourceId], folderId, pageId",
      cache: "key",
    });
  }
}

export const db = new RelibDB();

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
    folder: Folder;
    pages: Page[];
    sources: Source[];
    suggestions: Suggestion[];
    tree: unknown;
  };
  await db.transaction("rw", [db.folders, db.pages, db.sources, db.suggestions, db.cache], async () => {
    await db.folders.put(seed.folder);
    await db.pages.bulkPut(seed.pages);
    await db.sources.bulkPut(seed.sources);
    await db.suggestions.bulkPut(seed.suggestions);
    await db.cache.put({ key: treeKey(seed.folder.id), value: seed.tree });
  });
}

export async function createPage(folderId: string) {
  const id = crypto.randomUUID();
  await db.pages.add({ id, folderId, title: "", editorState: "", plainText: "", createdAt: Date.now(), updatedAt: Date.now() });
  return id;
}

export async function createFolder(name: string) {
  const id = crypto.randomUUID();
  await db.folders.add({ id, name, createdAt: Date.now() });
  return createPage(id);
}

export const treeKey = (folderId: string) => `tree:${folderId}`;
