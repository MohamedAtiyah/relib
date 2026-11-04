import { words } from "../agent/rank";
import type { Source } from "../schemas";
import { sourceId } from "./id";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTITIES[e]);
const tag = (xml: string, name: string) =>
  decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "").replace(/\s+/g, " ").trim();

export function parseArxiv(xml: string): Source[] {
  return (xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []).flatMap((entry) => {
    const url = tag(entry, "id").replace("http://", "https://");
    const title = tag(entry, "title");
    if (!title || !url.startsWith("https://")) return [];
    const authors = [...entry.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => decode(m[1])).slice(0, 8);
    const year = Number(tag(entry, "published").slice(0, 4)) || undefined;
    return [{ id: sourceId(url), title, authors, year, abstract: tag(entry, "summary"), url, origin: "arxiv" as const }];
  });
}

// shortcut: arXiv asks for one request per 3s; this gate is per server instance, use a shared store if traffic grows
let gate = Promise.resolve();
const nextSlot = () => {
  const slot = gate;
  gate = gate.then(() => new Promise((r) => setTimeout(r, 3000)));
  return slot;
};

export async function searchArxiv(query: string, limit = 5): Promise<Source[]> {
  await nextSlot();
  const q = encodeURIComponent(words(query).map((w) => `all:${w}`).join(" AND "));
  const res = await fetch(`https://export.arxiv.org/api/query?search_query=${q}&max_results=${limit}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`arXiv ${res.status}`);
  return parseArxiv(await res.text());
}

export async function arxivById(id: string): Promise<Source | null> {
  await nextSlot();
  const res = await fetch(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`arXiv ${res.status}`);
  return parseArxiv(await res.text())[0] ?? null;
}
