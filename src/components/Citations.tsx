import { createContext, useContext } from "react";
import type { CiteRef } from "@/lib/cite";

// What every chip needs to render itself: filled in by the research page, read by each CitationNode.
export type CiteContext = {
  render(refs: CiteRef[], key: string): string; // the chip text in the page's style
  edit(key: string, refs: CiteRef[]): void; // set a page locator
};

export const CitationContext = createContext<CiteContext | null>(null);

export function CitationChip({ nodeKey, refs }: { nodeKey: string; refs: CiteRef[] }) {
  const ctx = useContext(CitationContext);
  const text = ctx?.render(refs, nodeKey) || "(citation)";
  return (
    <button
      type="button"
      onClick={() => {
        const page = window.prompt("Page or page range for this citation (leave empty for none)", refs[0]?.locator ?? "");
        if (page !== null) ctx?.edit(nodeKey, refs.map((r, i) => (i === 0 ? { ...r, locator: page.trim().slice(0, 20) || undefined } : r)));
      }}
      title="Citation: click to add a page number"
      className="mx-0.5 rounded bg-spark-wash px-1 text-[0.9em] text-spark-ink"
    >
      {text}
    </button>
  );
}
