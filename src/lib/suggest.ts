import { rankSources } from "./agent/rank";
import { getMode, post } from "./api";
import { cached, db } from "./db";
import type { FitGap, Page, Source, Topics } from "./schemas";

export type Stage = "reading" | "searching" | "checking";

const MAX_NEW = 4; // each new suggestion is one paid model call
export const MIN_NOTES = 80;
const MIN_CHANGE = 40;

export const pageNotes = (page: Page) => `${page.title}\n${page.plainText}`.trim();

export function needsRun(page: Page) {
  const notes = pageNotes(page);
  if (notes.length < MIN_NOTES || notes === page.analysedText) return false;
  return Math.abs(notes.length - (page.analysedText?.length ?? 0)) >= MIN_CHANGE;
}

export async function runAgent(page: Page, onStage: (stage: Stage) => void) {
  const notes = pageNotes(page);
  const mode = await getMode(); // keeps stand-in results out of the cache once a real key is added

  onStage("reading");
  const { field, topics } = await cached(["topics", mode, notes], () => post<Topics>("topics", { notes }));

  onStage("searching");
  const queries = topics.map((t) => `${t.label} ${field}`);
  const found = queries.length
    ? await cached(["sources", queries], () => post<Source[]>("sources", { topics: queries }))
    : [];

  const seen = await db.suggestions.where({ folderId: page.folderId }).toArray();
  const feedback = await Promise.all(
    (["accepted", "declined"] as const).map(async (status) => {
      const ids = seen.filter((s) => s.status === status).map((s) => s.sourceId);
      return (await db.sources.bulkGet(ids)).flatMap((s) => s?.title ?? []);
    }),
  );
  const known = new Set(seen.map((s) => s.sourceId));
  const fresh = rankSources(found.filter((s) => !known.has(s.id)), notes, {
    accepted: feedback[0],
    declined: feedback[1],
  }).slice(0, MAX_NEW);

  onStage("checking");
  const results = await Promise.allSettled(
    fresh.map(async (source) => {
      const fitGap = await cached(["analyze", mode, notes, source.id], () =>
        post<FitGap>("analyze", { notes, source }),
      );
      await db.sources.put(source);
      await db.suggestions.put({ pageId: page.id, sourceId: source.id, folderId: page.folderId, fitGap, status: "new", createdAt: Date.now() });
    }),
  );
  const failed = results.find((r) => r.status === "rejected");
  if (failed && results.every((r) => r.status === "rejected")) throw failed.reason;
  await db.pages.update(page.id, { analysedText: notes });
}
