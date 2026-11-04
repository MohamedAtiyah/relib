import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { deleteFile, errorText } from "@/lib/api";
import { db } from "@/lib/db";
import type { Page, Source, Suggestion } from "@/lib/schemas";
import { MIN_NOTES, needsRun, pageNotes, runAgent, type Stage } from "@/lib/suggest";
import { SourceCard } from "./SourceCard";

const STAGE_TEXT: Record<Stage, string> = {
  reading: "Reading your notes",
  searching: "Searching OpenAlex and arXiv",
  checking: "Checking fit and gaps against your notes",
};

const WEAK_FIT = 25; // below this a match is mostly noise, so it waits behind a button

export function SourcePanel({ page, sources }: { page: Page; sources: Map<string, Source> }) {
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
    if (stage || !needsRun(page) || failedNotes.current === pageNotes(page)) return;
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

  return (
    <aside aria-label="Sources" className="flex w-96 shrink-0 flex-col bg-sand">
      <div className="flex h-14 items-center justify-between px-4">
        <h2 className="font-display text-xl font-semibold">Sources</h2>
        {stage && (
          <span role="status" className="flex items-center gap-2 text-xs text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-spark" aria-hidden="true" />
            {STAGE_TEXT[stage]}
          </span>
        )}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6">
        {error && (
          <div role="alert" className="rounded-card border border-hairline p-3 text-sm">
            {error}{" "}
            <button onClick={run} className="underline">
              Try again
            </button>
          </div>
        )}
        {!ranked.length && !saved.length && !stage && !error && (
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
                  {source.origin === "user" && <DeleteFile id={source.id} onError={setError} />}
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
            <h3 className="pt-3 text-xs font-medium text-muted">Saved to this folder ({saved.length})</h3>
            {saved.map((s) => {
              const source = sources.get(s.sourceId);
              return (
                source && (
                  <SourceCard key={s.sourceId} source={source} fitGap={s.fitGap}>
                    {source.origin === "user" && <DeleteFile id={source.id} onError={setError} />}
                  </SourceCard>
                )
              );
            })}
          </>
        )}
      </div>
    </aside>
  );
}

function DeleteFile({ id, onError }: { id: string; onError(text: string): void }) {
  const remove = () => {
    if (window.confirm("Delete this PDF from your account? This cannot be undone.")) deleteFile(id).catch((err) => onError(errorText(err)));
  };
  return (
    <button onClick={remove} className="rounded-full px-2 py-1 text-xs text-muted underline hover:text-ink">
      Delete file
    </button>
  );
}
