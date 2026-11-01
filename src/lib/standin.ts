import { words } from "./agent/rank";
import type { Msg } from "./model";

// Keyword heuristics that keep the app runnable without a META_API_KEY. Not AI: the UI labels it.
export function standIn(messages: Msg[], schemaName?: string): string {
  const prompt = messages.filter((m) => m.role !== "assistant").at(-1)?.content ?? "";
  if (schemaName === "topics") return JSON.stringify(topics(prompt));
  if (schemaName === "fit_gap") return JSON.stringify(fitGap(prompt));
  if (schemaName === "neurolib") return JSON.stringify(tree(prompt));
  return /\b(write|draft|compose)\b/i.test(prompt)
    ? "I can't write your notes, but I can explain the idea and point to sources. Want to go through it step by step?"
    : "Stand-in tutor: add META_API_KEY to get real explanations from Muse Spark.";
}

const section = (text: string, name: string, next?: string) => {
  const start = text.indexOf(`${name}:\n`);
  if (start < 0) return "";
  const body = text.slice(start + name.length + 2);
  return next ? body.split(`\n${next}:\n`)[0] : body;
};

function topTerms(text: string, n: number) {
  const counts = new Map<string, number>();
  for (const w of words(text)) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}

function topics(prompt: string) {
  const notes = section(prompt, "NOTES");
  const title = notes.split("\n")[0].trim();
  const parent = title.split(/\s+/).length <= 6 ? title : undefined;
  return {
    field: parent ?? "research",
    topics: [
      ...(parent ? [{ label: parent }] : []),
      ...topTerms(notes, 3).map((label) => ({ label, parent })),
    ],
  };
}

function fitGap(prompt: string) {
  const abstract = section(prompt, "SOURCE ABSTRACT");
  const terms = topTerms(section(prompt, "NOTES", "SOURCE ABSTRACT"), 12);
  const seen = new Set(words(abstract));
  const covered = terms.filter((t) => seen.has(t));
  const missing = terms.filter((t) => !seen.has(t));
  const sentences = abstract.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [abstract];
  return {
    summary: sentences.slice(0, 2).join(" "),
    whyItHelps: [covered.length ? `Mentions ${covered.slice(0, 4).join(", ")} from your notes.` : "No terms in common with your notes."],
    weakPoints: [
      ...(abstract.length < 300 ? ["The abstract is too thin to judge."] : []),
      ...(missing.length ? [`Does not mention ${missing.slice(0, 4).join(", ")}.`] : []),
    ],
    keyPoints: sentences.slice(0, 3).map((s) => s.slice(0, 160)),
    relevance: Math.round((100 * covered.length) / (terms.length || 1)),
  };
}

function tree(prompt: string) {
  const pages = section(prompt, "PAGES", "SOURCES").split(/^# /m).filter(Boolean);
  const sources = section(prompt, "SOURCES")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [id, title = ""] = line.split(" | ");
      return { id, terms: new Set(words(title)) };
    });
  const claimed = new Set<string>();
  const nodes = pages.flatMap((page, i) => {
    const [title, ...body] = page.split("\n");
    return [
      { id: `t${i}`, label: title.trim(), sourceIds: [] as string[] },
      ...topTerms(body.join(" "), 3).map((label, j) => {
        const sourceIds = sources.filter((s) => s.terms.has(label) && !claimed.has(s.id)).map((s) => s.id);
        sourceIds.forEach((id) => claimed.add(id));
        return { id: `t${i}-${j}`, label, parentId: `t${i}`, sourceIds };
      }),
    ];
  });
  return { nodes };
}
