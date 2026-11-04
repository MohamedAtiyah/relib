import type { Source } from "../schemas";
import { sourceId } from "./id";

type Work = {
  id: string;
  doi?: string | null;
  title?: string | null;
  publication_year?: number | null;
  authorships?: { author?: { display_name?: string } }[];
  abstract_inverted_index?: Record<string, number[]> | null;
  primary_location?: { landing_page_url?: string | null } | null;
};

export function rebuildAbstract(index: Record<string, number[]>): string {
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) for (const p of positions) words[p] = word;
  return words.filter(Boolean).join(" ");
}

export function normalise(work: Work): Source | null {
  const url = work.doi ?? work.primary_location?.landing_page_url ?? work.id;
  if (!work.title || !work.abstract_inverted_index || !/^https?:\/\//.test(url)) return null;
  return {
    id: sourceId(work.doi ?? url),
    title: work.title.replace(/<[^>]+>/g, ""),
    authors: (work.authorships ?? []).flatMap((a) => a.author?.display_name ?? []).slice(0, 8),
    year: work.publication_year ?? undefined,
    abstract: rebuildAbstract(work.abstract_inverted_index),
    url,
    doi: work.doi?.replace("https://doi.org/", ""),
    origin: "openalex",
  };
}

export async function searchOpenAlex(query: string, limit = 10): Promise<Source[]> {
  const params = new URLSearchParams({
    // semantic search: keyword search returned off-field papers for short concepts
    "search.semantic": query,
    filter: "has_abstract:true,language:en,type:article",
    "per-page": String(limit),
    select: "id,doi,title,publication_year,authorships,abstract_inverted_index,primary_location",
  });
  if (process.env.OPENALEX_MAILTO) params.set("mailto", process.env.OPENALEX_MAILTO);
  if (process.env.OPENALEX_API_KEY) params.set("api_key", process.env.OPENALEX_API_KEY);
  const res = await fetch(`https://api.openalex.org/works?${params}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`OpenAlex ${res.status}`);
  const data: { results: Work[] } = await res.json();
  return data.results.flatMap((w) => normalise(w) ?? []);
}

export async function openAlexByDoi(doi: string): Promise<Source | null> {
  const params = new URLSearchParams({ select: "id,doi,title,publication_year,authorships,abstract_inverted_index,primary_location" });
  if (process.env.OPENALEX_MAILTO) params.set("mailto", process.env.OPENALEX_MAILTO);
  if (process.env.OPENALEX_API_KEY) params.set("api_key", process.env.OPENALEX_API_KEY);
  const res = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?${params}`, { signal: AbortSignal.timeout(10_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OpenAlex ${res.status}`);
  const work: Work = await res.json();
  // a source the student added by hand is kept even without an abstract; the card then says so
  return normalise({ ...work, abstract_inverted_index: work.abstract_inverted_index ?? { "(No abstract available.)": [0] } });
}
