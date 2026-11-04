import { useLiveQuery } from "dexie-react-hooks";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import type { Folder, Source } from "@/lib/schemas";

const AWAY = 6 * 60 * 60 * 1000; // shorter gaps are the same sitting

function ago(time: number) {
  const hours = (Date.now() - time) / 3_600_000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  return hours < 48 ? rtf.format(-Math.round(hours), "hour") : rtf.format(-Math.round(hours / 24), "day");
}

// Facts from this folder's own records only; nothing here is generated.
export function CatchUp({ folder, sources }: { folder: Folder; sources: Map<string, Source> }) {
  // read once on open: the effect below moves lastOpenedAt to now
  const [{ since, away }] = useState(() => ({
    since: folder.lastOpenedAt ?? 0,
    away: folder.lastOpenedAt !== undefined && Date.now() - folder.lastOpenedAt > AWAY,
  }));
  const [hidden, setHidden] = useState(false);
  const fresh = useLiveQuery(
    () =>
      away
        ? db.suggestions
            .where({ folderId: folder.id })
            .filter((s) => s.status === "new" && (s.createdAt ?? 0) > since)
            .toArray()
        : [],
    [folder.id, since],
  );
  const edited = useLiveQuery(
    () => (away ? db.pages.where({ folderId: folder.id }).filter((p) => p.updatedAt > since).count() : 0),
    [folder.id, since],
  );

  useEffect(() => {
    db.folders.update(folder.id, { lastOpenedAt: Date.now() });
  }, [folder.id]);

  if (hidden || !away || !fresh?.length) return null;
  const top = [...fresh].sort((a, b) => b.fitGap.relevance - a.fitGap.relevance).slice(0, 3);

  return (
    <section aria-label="Since your last visit" className="mx-auto mt-6 max-w-2xl px-8">
      <div className="rounded-card bg-sand p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Since your last visit</h2>
            <p className="text-xs text-muted">
              {folder.name} · last opened {ago(since)}
            </p>
          </div>
          <button onClick={() => setHidden(true)} aria-label="Dismiss catch-up" className="rounded-lg p-1 text-muted hover:bg-surface">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <p className="mt-3 text-sm">
          {fresh.length} new {fresh.length === 1 ? "source" : "sources"} waiting in the panel
          {edited ? `, ${edited} ${edited === 1 ? "page" : "pages"} changed` : ""}.
        </p>
        <ul className="mt-2 space-y-2">
          {top.map((s) => (
            <li key={s.sourceId} className="text-sm">
              <span className="font-medium">{sources.get(s.sourceId)?.title ?? "A source"}</span>
              <span className="text-muted"> · fit {s.fitGap.relevance}/100</span>
              {s.fitGap.weakPoints[0] && <span className="block text-xs text-spark-ink">Weak point: {s.fitGap.weakPoints[0]}</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
