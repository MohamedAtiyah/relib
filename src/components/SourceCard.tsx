import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { FitGap, Source } from "@/lib/schemas";

function Points({ title, items, accent }: { title: string; items: string[]; accent?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <h4 className={`text-xs font-medium ${accent ? "text-spark-ink" : "text-muted"}`}>{title}</h4>
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
      <span className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${full ? "bg-spark-wash text-spark-ink" : "bg-sand text-muted"}`}>
        {full ? "Full text" : "Abstract only"}
      </span>
      <h3 className="text-sm leading-snug font-medium">{source.title}</h3>
      <p className="mt-1 text-xs text-muted">
        {source.origin === "user"
          ? "Your upload"
          : [source.authors.slice(0, 3).join(", ") || "Unknown authors", source.year].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-3 text-xs font-medium text-muted">AI summary of the {full ? "full text" : "abstract"}</p>
      <p className="mt-1 text-sm">{fitGap.summary}</p>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="mt-2 flex items-center gap-1 text-xs text-muted hover:text-ink"
      >
        <ChevronDown size={14} strokeWidth={1.5} className={open ? "rotate-180" : ""} />
        Fit with your notes: {fitGap.relevance}/100
      </button>
      {open && (
        <>
          <Points title="Why it helps" items={fitGap.whyItHelps} />
          <Points title="Weak points" items={fitGap.weakPoints} accent />
          <Points title="Key points" items={fitGap.keyPoints} />
          <p className="mt-3 text-xs text-muted">{full ? "Based on the full text of your PDF." : "Based on the abstract only."}</p>
        </>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <a href={source.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted underline hover:text-ink">
          {source.origin === "user" ? "Open PDF" : "Original"} <ExternalLink size={12} strokeWidth={1.5} />
        </a>
        {children}
      </div>
    </article>
  );
}
