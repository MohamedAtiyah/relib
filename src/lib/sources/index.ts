import type { Source } from "../schemas";
import { arxivById, searchArxiv } from "./arxiv";
import { openAlexByDoi, searchOpenAlex } from "./openalex";

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

// A DOI, a doi.org link or an arXiv id or link the student pasted. Anything else is not looked up.
export function parseRef(ref: string): { doi: string } | { arxiv: string } | null {
  const text = ref.trim();
  const doi = text.match(/\b(10\.\d{4,9}\/[^\s"<>]+)/);
  if (doi) return { doi: doi[1].replace(/[.,;)]+$/, "") };
  const arxiv = text.match(/(?:arxiv\.org\/(?:abs|pdf)\/|arxiv:)?\b(\d{4}\.\d{4,5}(?:v\d+)?)\b/i);
  return arxiv ? { arxiv: arxiv[1] } : null;
}

export async function lookupRef(ref: string): Promise<Source | null> {
  const parsed = parseRef(ref);
  if (!parsed) return null;
  return "doi" in parsed ? openAlexByDoi(parsed.doi) : arxivById(parsed.arxiv);
}
