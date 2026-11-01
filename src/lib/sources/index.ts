import type { Source } from "../schemas";
import { searchArxiv } from "./arxiv";
import { searchOpenAlex } from "./openalex";

const cache = new Map<string, Source[]>();

// The brief keeps war and politics out of the product, and arXiv surfaces them from plain economics queries.
const OFF_LIMITS = /\b(war|wars|wartime|invasion|ukraine|russia|russian|gaza|israel|election|elections|military|sanctions)\b/i;

async function once(key: string, search: () => Promise<Source[]>) {
  const hit = cache.get(key);
  if (hit) return hit;
  const found = await search();
  cache.set(key, found);
  return found;
}

export function dedupe(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const keys = [s.doi?.toLowerCase(), s.title.toLowerCase().replace(/[^a-z0-9]/g, "")].filter(Boolean) as string[];
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });
}

export async function searchSources(topics: string[]): Promise<Source[]> {
  const results = await Promise.allSettled([
    ...topics.slice(0, 4).map((t) => once(`openalex:${t}`, () => searchOpenAlex(t))),
    ...topics.slice(0, 2).map((t) => once(`arxiv:${t}`, () => searchArxiv(t))),
  ]);
  const found = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (!found.length && results.some((r) => r.status === "rejected")) throw new Error("All source searches failed");
  return dedupe(found).filter((s) => !OFF_LIMITS.test(`${s.title} ${s.abstract}`));
}
