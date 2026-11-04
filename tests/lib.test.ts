import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { z } from "zod";
import { rankSources } from "@/lib/agent/rank";
import { chatJson } from "@/lib/model";
import type { Source } from "@/lib/schemas";
import { parseArxiv } from "@/lib/sources/arxiv";
import { dedupe } from "@/lib/sources";
import { normalise, rebuildAbstract } from "@/lib/sources/openalex";
import { nodeWeight } from "@/lib/weight";

const source = (over: Partial<Source>): Source => ({
  id: "x", title: "t", authors: [], abstract: "a".repeat(250), url: "https://a.test", origin: "openalex", ...over,
});

test("rebuildAbstract restores word order and repeats", () => {
  assert.equal(rebuildAbstract({ supply: [0, 2], and: [1] }), "supply and supply");
});

test("normalise drops works without abstracts or safe urls", () => {
  assert.equal(normalise({ id: "https://o.org/W1", title: "T" }), null);
  assert.equal(normalise({ id: "javascript:alert(1)", title: "T", abstract_inverted_index: { a: [0] } }), null);
  const s = normalise({ id: "https://o.org/W1", doi: "https://doi.org/10.1/X", title: "<i>T</i>", abstract_inverted_index: { a: [0] } });
  assert.equal(s?.title, "T");
  assert.equal(s?.doi, "10.1/X");
});

test("parseArxiv reads entries and decodes entities", () => {
  const [s] = parseArxiv(`<feed><title>query</title><entry><id>http://arxiv.org/abs/1v1</id><title>A &amp; B</title><summary> long
    text </summary><published>2016-02-14T00:00:00Z</published><author><name>Ann Lee</name></author></entry></feed>`);
  assert.deepEqual([s.title, s.abstract, s.year, s.authors, s.url], ["A & B", "long text", 2016, ["Ann Lee"], "https://arxiv.org/abs/1v1"]);
});

test("dedupe matches on doi or title", () => {
  const out = dedupe([
    source({ id: "1", title: "Same Title", doi: "10.1/a" }),
    source({ id: "2", title: "same title!" }),
    source({ id: "3", title: "Other", doi: "10.1/A" }),
    source({ id: "4", title: "Fresh" }),
  ]);
  assert.deepEqual(out.map((s) => s.id), ["1", "4"]);
});

test("rankSources follows notes, then accepts and declines nudge ties", () => {
  const prices = source({ id: "prices", title: "market prices equilibrium" });
  const wages = source({ id: "wages", title: "market wages equilibrium" });
  const oceans = source({ id: "oceans", title: "ocean iron chemistry" });
  const notes = "market equilibrium";
  const ids = (accepted: string[], declined: string[]) =>
    rankSources([oceans, wages, prices], notes, { accepted, declined }).map((s) => s.id);
  assert.equal(ids([], []).at(-1), "oceans");
  assert.deepEqual(ids([], ["market wages"]).slice(0, 2), ["prices", "wages"]);
  assert.deepEqual(ids(["market wages"], []).slice(0, 2), ["wages", "prices"]);
  assert.deepEqual(rankSources([source({ abstract: "short" })], notes, { accepted: [], declined: [] }), []);
});

test("nodeWeight grows with pages, accepted sources and child depth", () => {
  const pages = [{ plainText: "Elasticity of demand" }];
  const nodes = [
    { id: "root", label: "Demand", sourceIds: [] },
    { id: "leaf", label: "Elasticity", parentId: "root", sourceIds: ["s1", "s2"] },
    { id: "empty", label: "Absent", parentId: "root", sourceIds: ["s3"] },
  ];
  const accepted = new Set(["s1"]);
  const [root, leaf, empty] = nodes.map((n) => nodeWeight(n, nodes, pages, accepted));
  assert.ok(leaf > empty);
  assert.ok(root > leaf);
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.META_API_KEY;
});

test("chatJson sends json_schema, then retries once with the error", async () => {
  process.env.META_API_KEY = "test-key";
  const bodies: { response_format: { type: string }; messages: unknown[] }[] = [];
  const replies = ["not json", '{"concept":"elasticity"}'];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(init.body as string));
    return Response.json({ choices: [{ message: { content: replies[bodies.length - 1] } }] });
  }) as typeof fetch;
  const out = await chatJson({ tag: "t", messages: [{ role: "user", content: "hi" }] }, z.object({ concept: z.string() }));
  assert.deepEqual(out, { concept: "elasticity" });
  assert.equal(bodies[0].response_format.type, "json_schema");
  assert.equal(bodies[1].messages.length, 3);
});

test("parseRef reads DOIs and arXiv ids, nothing else", async () => {
  const { parseRef } = await import("../src/lib/sources");
  assert.deepEqual(parseRef("https://doi.org/10.1257/aer.91.4.1"), { doi: "10.1257/aer.91.4.1" });
  assert.deepEqual(parseRef("see 10.1000/xyz123."), { doi: "10.1000/xyz123" });
  assert.deepEqual(parseRef("https://arxiv.org/abs/2301.01234v2"), { arxiv: "2301.01234v2" });
  assert.equal(parseRef("https://example.com/blog"), null);
});
