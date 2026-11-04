// Safety test D: one user can never read or overwrite another user's rows by changing an id.
// Runs against a real Postgres: DATABASE_URL=postgres://... npm test
import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";

let signedIn: string | null = null;
mock.module("@clerk/nextjs/server", { namedExports: { auth: async () => ({ userId: signedIn }) } });
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||= "pk_test_placeholder";

const skip = !process.env.DATABASE_URL && "set DATABASE_URL to run";
const A = `test-a-${Date.now()}`;
const B = `test-b-${Date.now()}`;
const url = "http://localhost/api/sync";
const params = { params: Promise.resolve({}) };

type Sync = typeof import("../src/app/api/sync/route");
let sync: Sync;
let files: typeof import("../src/app/api/files/[id]/route");
let sql: typeof import("../src/lib/sql").sql;

const as = (user: string | null) => (signedIn = user);
const get = async () => (await sync.GET(new Request(url), params)).json();
const push = (body: unknown) => sync.POST(new Request(url, { method: "POST", body: JSON.stringify(body) }), params);
const page = (title: string, updatedAt: number) => ({
  id: "same-id",
  folderId: "f1",
  title,
  editorState: "",
  plainText: title,
  createdAt: 1,
  updatedAt,
});

before(async () => {
  if (skip) return;
  sync = await import("../src/app/api/sync/route");
  files = await import("../src/app/api/files/[id]/route");
  sql = (await import("../src/lib/sql")).sql;
});

after(async () => {
  if (skip) return;
  for (const t of ["folders", "pages", "files", "users"]) {
    await sql()`delete from ${sql()(t)} where ${sql()(t === "users" ? "id" : "owner_id")} in (${A}, ${B})`;
  }
  await sql().end();
});

test("signed out gets nothing", { skip }, async () => {
  as(null);
  assert.equal((await sync.GET(new Request(url), params)).status, 401);
});

test("the same page id stays separate per user", { skip }, async () => {
  as(A);
  assert.equal((await push({ pages: [page("A's notes", 10)] })).status, 200);
  as(B);
  assert.equal((await push({ pages: [page("B's notes", 20)] })).status, 200);
  assert.deepEqual((await get()).pages.map((p: { title: string }) => p.title), ["B's notes"]);
  as(A);
  assert.deepEqual((await get()).pages.map((p: { title: string }) => p.title), ["A's notes"]);
});

test("an owner id in the body is ignored", { skip }, async () => {
  as(B);
  await push({ pages: [{ ...page("planted", 99), ownerId: A }] });
  as(A);
  assert.deepEqual((await get()).pages.map((p: { title: string }) => p.title), ["A's notes"]);
});

test("an older write does not replace a newer one", { skip }, async () => {
  as(A);
  await push({ pages: [page("stale", 5)] });
  assert.equal((await get()).pages[0].title, "A's notes");
});

test("bad rows are refused", { skip }, async () => {
  as(A);
  assert.equal((await push({ folders: [{ id: "x", name: "n", kind: "admin" }] })).status, 400);
});

test("another user's file id is not found", { skip }, async () => {
  await sql()`insert into files ${sql()({ ownerId: A, id: "file-1", folderId: "f1", storageKey: `${A}/x.pdf`, filename: "x.pdf", mime: "application/pdf", size: 1, createdAt: 1 })}`;
  as(B);
  const req = new Request("http://localhost/api/files/file-1");
  const ctx = { params: Promise.resolve({ id: "file-1" }) };
  assert.equal((await files.GET(req, ctx)).status, 404);
  assert.equal((await files.DELETE(new Request(req, { method: "DELETE" }), ctx)).status, 404);
});
