import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { errorText, post } from "@/lib/api";
import { db } from "@/lib/db";
import type { FitGap, Page, Source, Suggestion } from "@/lib/schemas";
import { MIN_NOTES, needsRun, pageNotes, runAgent, type Stage } from "@/lib/suggest";
import { Materials } from "./Materials";
import { SourceCard } from "./SourceCard";

const STAGE_TEXT: Record<Stage, string> = {
  reading: "Reading your notes",
  searching: "Searching OpenAlex and arXiv",
  checking: "Checking fit and gaps against your notes",
};

const WEAK_FIT = 25; // below this a match is mostly noise, so it waits behind a button

export function SourcePanel({ page, sources, userId }: { page: Page; sources: Map<string, Source>; userId?: string }) {
  const suggestions = useLiveQuery(() => db.suggestions.where({ folderId: page.folderId }).toArray(), [page.folderId]) ?? [];
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const failedNotes = useRef<string | null>(null);

  const run = async () => {
    setError(null);
    failedNotes.current = null;
    try {
      await runAgent(page, setStage);
    } catch (err) {
      failedNotes.current = pageNotes(page); // stops the retry loop until the notes change
      setError(errorText(err));
    }
    setStage(null);
  };

  useEffect(() => {
    if (!page.sourcesOn || stage || !needsRun(page) || failedNotes.current === pageNotes(page)) return;
    const timer = setTimeout(run, 3000);
    return () => clearTimeout(timer);
  });

  const setStatus = (s: Suggestion, status: Suggestion["status"]) =>
    db.suggestions.update([s.pageId, s.sourceId], { status });

  const [showWeak, setShowWeak] = useState(false);
  const ranked = suggestions
    .filter((s) => s.status === "new" && s.pageId === page.id)
    .sort((a, b) => b.fitGap.relevance - a.fitGap.relevance);
  const weak = ranked.filter((s) => s.fitGap.relevance < WEAK_FIT).length;
  const fresh = showWeak ? ranked : ranked.filter((s) => s.fitGap.relevance >= WEAK_FIT);
  const saved = suggestions.filter((s) => s.status === "accepted");
  const [adding, setAdding] = useState(false);

  // a DOI or arXiv link the student pasted: looked up, never guessed
  const addRef = async (ref: string) => {
    setError(null);
    setAdding(true);
    try {
      const { source } = await post<{ source: Source | null }>("lookup", { ref });
      if (!source) throw new Error("not_found");
      const fitGap = await post<FitGap>("analyze", { notes: pageNotes(page) || page.title || source.title, source });
      await db.sources.put(source);
      await db.suggestions.put({ pageId: page.id, sourceId: source.id, folderId: page.folderId, fitGap, status: "new", createdAt: Date.now() });
    } catch (err) {
      setError(err instanceof Error && err.message === "not_found" ? "No record found for that DOI or arXiv link." : errorText(err));
    }
    setAdding(false);
  };

  return (
    <aside aria-label="Sources and materials" className="flex w-96 shrink-0 flex-col bg-sand">
      <div className="flex h-14 items-center justify-between px-4">
        <h2 className="font-display text-xl font-semibold">Sources</h2>
        <button
          role="switch"
          aria-checked={Boolean(page.sourcesOn)}
          aria-label="Suggest sources for this note"
          onClick={() => db.pages.update(page.id, { sourcesOn: !page.sourcesOn })}
          className={`relative h-5 w-9 rounded-full transition-colors ${page.sourcesOn ? "bg-ink" : "bg-hairline"}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-all ${page.sourcesOn ? "left-[18px]" : "left-0.5"}`} />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {stage && (
          <p role="status" className="flex items-center gap-2 text-xs text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-spark" aria-hidden="true" />
            {STAGE_TEXT[stage]}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("ref") as HTMLInputElement;
            if (input.value.trim()) addRef(input.value);
            input.value = "";
          }}
        >
          <input
            name="ref"
            disabled={adding}
            aria-label="Add a source by DOI or arXiv link"
            placeholder={adding ? "Looking it up…" : "Add a DOI or arXiv link"}
            maxLength={500}
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-1.5 text-sm placeholder:text-muted"
          />
        </form>
        {error && (
          <div role="alert" className="rounded-card border border-hairline p-3 text-sm">
            {error}{" "}
            <button onClick={run} className="underline">
              Try again
            </button>
          </div>
        )}
        {!page.sourcesOn && <p className="text-sm text-muted">Suggestions are off for this note. Turn them on to have Relib search OpenAlex and arXiv.</p>}
        {page.sourcesOn && !ranked.length && !stage && !error && (
          <p className="text-sm text-muted">
            {pageNotes(page).length < MIN_NOTES
              ? "Keep writing. Sources appear once there is enough to go on."
              : "No suggestions yet. They appear a few seconds after you stop typing."}
          </p>
        )}
        {fresh.map((s) => {
          const source = sources.get(s.sourceId);
          return (
            source && (
              <SourceCard key={s.sourceId} source={source} fitGap={s.fitGap}>
                <div className="flex gap-2">
                  <button onClick={() => setStatus(s, "declined")} className="rounded-full border border-hairline px-3 py-1 text-xs hover:bg-sand">
                    Decline
                  </button>
                  <button onClick={() => setStatus(s, "accepted")} className="rounded-full bg-ink px-3 py-1 text-xs text-paper">
                    Accept
                  </button>
                </div>
              </SourceCard>
            )
          );
        })}
        {weak > 0 && (
          <button onClick={() => setShowWeak(!showWeak)} className="text-xs text-muted underline hover:text-ink">
            {showWeak ? "Hide weaker matches" : `Show ${weak} weaker ${weak === 1 ? "match" : "matches"} (fit under ${WEAK_FIT})`}
          </button>
        )}
        {saved.length > 0 && (
          <>
            <h3 className="label pt-3">Saved to this folder ({saved.length})</h3>
            {saved.map((s) => {
              const source = sources.get(s.sourceId);
              return (
                source && <SourceCard key={s.sourceId} source={source} fitGap={s.fitGap} />
              );
            })}
          </>
        )}
      </div>
      <Materials key={page.folderId} folderId={page.folderId} userId={userId} />
    </aside>
  );
}

