import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { FitGap, Source } from "@/lib/schemas";

function Points({ title, items, className }: { title: string; items: string[]; className: string }) {
  if (!items.length) return null;
  return (
    <div className={`mt-3 rounded-lg p-3 ${className}`}>
      <h4 className="label">{title}</h4>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function SourceCard({
  source,
  fitGap,
  expanded = false,
  children,
}: {
  source: Source;
  fitGap: FitGap;
  expanded?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(expanded);
  const full = fitGap.basedOn === "full_text";
  return (
    <article className="rounded-card border border-hairline bg-surface p-4">
      <h3 className="text-sm leading-snug font-medium">{source.title}</h3>
      <p className="mt-1 text-xs text-muted">
        {source.origin === "user"
          ? "Your upload"
          : [source.authors.slice(0, 3).join(", ") || "Unknown authors", source.year].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-3 flex items-center gap-2" title={`Fit with your notes: ${fitGap.relevance}/100`}>
        <span className="label shrink-0">Fit</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand" role="meter" aria-label="Fit with your notes" aria-valuenow={fitGap.relevance} aria-valuemin={0} aria-valuemax={100}>
          <span className="block h-full rounded-full bg-ink" style={{ width: `${fitGap.relevance}%` }} />
        </span>
        <span className="text-xs text-muted">{fitGap.relevance}</span>
      </div>
      <p className="mt-3 text-sm">{fitGap.summary}</p>
      <Points title="Why it helps" items={fitGap.whyItHelps} className="bg-spark-wash" />
      <Points title="Weak points" items={fitGap.weakPoints} className="bg-sand" />
      {open && <Points title="Key points" items={fitGap.keyPoints} className="border border-hairline" />}
      <p className="mt-3 text-xs text-muted">{full ? "Based on the full text." : "Based on the abstract only."}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-3">
          <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1 text-xs text-muted hover:text-ink">
            <ChevronDown size={14} strokeWidth={1.5} className={open ? "rotate-180" : ""} />
            Deep read
          </button>
          <a href={source.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted underline hover:text-ink">
            {source.origin === "user" ? "Open file" : "Original"} <ExternalLink size={12} strokeWidth={1.5} />
          </a>
        </span>
        {children}
      </div>
    </article>
  );
}
