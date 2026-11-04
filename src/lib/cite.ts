import { Cite, plugins } from "@citation-js/core";
import "@citation-js/plugin-csl";
import type { Source } from "./schemas";

// CSL styles from citationstyles.org (CC BY-SA 3.0), pinned to the repository's release branch.
const STYLES_BASE = "https://raw.githubusercontent.com/citation-style-language/styles/v1.0.2";

export const PINNED = [
  { id: "apa", name: "APA 7" },
  { id: "modern-language-association", name: "MLA 9" },
  { id: "chicago-author-date-17th-edition", name: "Chicago 17 (author-date)" },
  { id: "chicago-notes-bibliography-17th-edition", name: "Chicago 17 (notes and bibliography)" },
  { id: "harvard-cite-them-right", name: "Harvard" },
  { id: "ieee", name: "IEEE" },
  { id: "vancouver", name: "Vancouver" },
  { id: "american-medical-association", name: "AMA" },
];

export const styleName = (id: string) => PINNED.find((s) => s.id === id)?.name ?? id;

type Format = "author-date" | "numeric" | "note" | "author" | "label";
const loaded = new Map<string, Promise<Format>>();
const csl = () => plugins.config.get("@csl") as { styles: { has(id: string): boolean; add(id: string, xml: string): void; get(id: string): string } };

const formatOf = (xml: string): Format => (xml.match(/citation-format="([a-z-]+)"/)?.[1] as Format) ?? "author-date";

async function fetchStyle(id: string): Promise<string> {
  const res = await fetch(`${STYLES_BASE}/${encodeURIComponent(id)}.csl`);
  if (!res.ok) throw new Error(`Style ${id} not found`);
  const xml = await res.text();
  // a dependent style only names its parent, which holds the formatting
  const parent = xml.match(/rel="independent-parent"\s+href="[^"]*\/styles\/([^"]+)"/)?.[1] ?? xml.match(/href="[^"]*\/styles\/([^"]+)"\s+rel="independent-parent"/)?.[1];
  return parent ? (await fetch(`${STYLES_BASE}/${parent}.csl`)).text() : xml;
}

// Registers a style once and says how it cites (author-date, numeric or note).
export function ensureStyle(id: string): Promise<Format> {
  let ready = loaded.get(id);
  if (!ready) {
    ready = (async () => {
      if (csl().styles.has(id)) return formatOf(csl().styles.get(id));
      const xml = await fetchStyle(id);
      csl().styles.add(id, xml);
      return formatOf(xml);
    })();
    ready.catch(() => loaded.delete(id));
    loaded.set(id, ready);
  }
  return ready;
}

function person(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? { literal: name } : { family: parts.at(-1)!, given: parts.slice(0, -1).join(" ") };
}

// CSL-JSON from what OpenAlex, arXiv or the student supplied. Nothing is filled in that was not given.
export function cslItem(s: Source) {
  return {
    id: s.id,
    type: s.origin === "arxiv" ? "article" : s.venue ? "article-journal" : "article",
    title: s.title,
    author: s.authors.map(person),
    ...(s.year && { issued: { "date-parts": [[s.year]] } }),
    ...(s.venue && { "container-title": s.venue }),
    ...(s.origin === "arxiv" && { publisher: "arXiv" }),
    ...(s.volume && { volume: s.volume }),
    ...(s.issue && { issue: s.issue }),
    ...(s.pages && { page: s.pages }),
    ...(s.doi && { DOI: s.doi }),
    URL: s.url,
  };
}

export type CiteRef = { id: string; locator?: string };

// citation-js's bundled types lag its options (template, entry with locators), so calls go through this
const format = (sources: Source[], kind: "bibliography" | "citation", options: Record<string, unknown>) =>
  (new Cite(sources.map(cslItem)).format as (kind: string, options: object) => string)(kind, { lang: "en-US", ...options });

export function bibliography(sources: Source[], style: string, output: "html" | "text" = "html"): string {
  if (!sources.length) return "";
  return format(sources, "bibliography", { format: output, template: style });
}

// Parenthetical form, e.g. (Smith & Lee, 2019, p. 12), or [3] for numeric styles. Order matters for numeric styles.
export function citation(all: Source[], refs: CiteRef[], style: string): string {
  const cited = refs.filter((r) => all.some((s) => s.id === r.id));
  if (!cited.length) return "";
  const entry = cited.map((r) => (r.locator ? { id: r.id, locator: r.locator, label: "page" } : { id: r.id }));
  return format(all, "citation", { format: "text", template: style, entry });
}

// Narrative form: the author named in the sentence, e.g. Smith and Lee (2019) or Smith and Lee [3].
export function narrative(source: Source, parenthetical: string, format: Format): string {
  const families = source.authors.map((a) => a.trim().split(/\s+/).at(-1));
  const who = families.length > 2 ? `${families[0]} et al.` : families.join(" and ") || source.title;
  if (format === "numeric") return `${who} ${parenthetical}`;
  return `${who} (${source.year ?? "n.d."})`;
}
