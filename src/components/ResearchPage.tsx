import type { LexicalEditor } from "lexical";
import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useState, type RefObject } from "react";
import { bibliography, citation, ensureStyle, PINNED, styleName, type CiteRef } from "@/lib/cite";
import { citationsInOrder, setRefs } from "@/lib/citehere";
import type { SlashContext } from "@/lib/commands";
import { db } from "@/lib/db";
import type { CoverField, Page, Preset, Research, Source } from "@/lib/schemas";
import { headingsOf, lexicalDoc } from "@/lib/starthere";
import { CitationContext, type CiteContext } from "./Citations";
import { Editor } from "./Editor";
import { ResearchStart } from "./ResearchStart";

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number) => [...String(n)].map((d) => SUPERSCRIPT[Number(d)]).join("");

type Props = {
  page: Page;
  folderPages: Page[];
  presets: Preset[];
  sources: Map<string, Source>;
  accepted: Source[];
  ctx: SlashContext;
  editorRef: RefObject<LexicalEditor | null>;
};

export function ResearchPage(props: Props) {
  const { page, folderPages, presets } = props;
  if (page.research) return <Paper {...props} research={page.research} />;
  const lastPaper = folderPages
    .filter((p) => p.type === "research" && p.research && p.id !== page.id)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return (
    <ResearchStart
      page={page}
      presets={presets}
      lastPaper={lastPaper}
      onStart={(research, sections) =>
        db.pages.update(page.id, {
          research,
          editorState: sections.length ? lexicalDoc(sections.flatMap((h) => [{ h }, { p: "" }])) : "",
          plainText: sections.join("\n"),
        })
      }
    />
  );
}

function Paper({ page, research, presets, sources, accepted, ctx, editorRef }: Props & { research: Research }) {
  const [loaded, setLoaded] = useState<{ style: string; format: string }>();
  const [failed, setFailed] = useState<string | null>(null);
  const [order, setOrder] = useState<{ key: string; refs: CiteRef[] }[]>([]);

  useEffect(() => {
    let live = true;
    ensureStyle(research.style).then(
      (format) => live && (setLoaded({ style: research.style, format }), setFailed(null)),
      () => live && setFailed(`Could not load the ${styleName(research.style)} style. Check your connection or pick another.`),
    );
    return () => {
      live = false;
    };
  }, [research.style]);

  // keep the list of citations in document order as the student writes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    setOrder(citationsInOrder(editor));
    return editor.registerUpdateListener(() => setOrder(citationsInOrder(editor)));
  }, [editorRef, page.id]);

  const cited = useMemo(() => {
    const ids = [...new Set(order.flatMap((c) => c.refs.map((r) => r.id)))];
    return ids.flatMap((id) => sources.get(id) ?? []);
  }, [order, sources]);
  // formatting waits until the page's current style is loaded, not the one before it
  const format = loaded?.style === research.style ? loaded.format : undefined;
  const ready = Boolean(format) && !failed;
  const safe = (run: () => string) => {
    try {
      return run();
    } catch {
      return "";
    }
  };

  const cite: CiteContext = {
    render: (refs, key) => {
      if (!ready) return "…";
      if (format === "note") return sup(order.findIndex((c) => c.key === key) + 1);
      return safe(() => citation(cited, refs, research.style)) || "(citation)";
    },
    edit: (key, refs) => editorRef.current && setRefs(editorRef.current, key, refs),
  };

  const update = (next: Partial<Research>) => db.pages.update(page.id, { research: { ...research, ...next } });
  const editCover = (cover: CoverField[]) => {
    update({ cover, presetId: undefined });
    // the cover's Title is the page's name in the sidebar
    if (cover[0]?.label === "Title" && cover[0].value !== page.title) db.pages.update(page.id, { title: cover[0].value.slice(0, 500) });
  };

  const saveAsPreset = async () => {
    const n = presets.length + 1;
    const id = crypto.randomUUID();
    await db.presets.put({ id, folderId: page.folderId, name: `Preset ${n}`, fields: research.cover, citationStyle: research.style, sections: headingsOf(page.editorState) });
    await update({ presetId: id });
  };

  const references = ready && cited.length ? safe(() => bibliography(cited, research.style)) : "";
  const unused = accepted.filter((s) => !cited.some((c) => c.id === s.id));

  return (
    <CitationContext.Provider value={cite}>
      <div className="min-h-full bg-sand px-4 py-6">
        <div className="mx-auto mb-3 flex w-[816px] max-w-full flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="label">Style</span>
            <select value={research.style} onChange={(e) => update({ style: e.target.value })} className="rounded-lg border border-hairline bg-surface px-2 py-1">
              {PINNED.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              {!PINNED.some((s) => s.id === research.style) && <option value={research.style}>{research.style}</option>}
            </select>
          </label>
          <button onClick={saveAsPreset} className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs hover:border-ink">
            Save cover as Preset {presets.length + 1}
          </button>
          {failed && <span role="alert" className="text-xs text-spark-ink">{failed}</span>}
        </div>
        <article className="mx-auto w-[816px] max-w-full rounded-card border border-hairline bg-surface px-8 py-12 2xl:px-[72px]">
          <Cover fields={research.cover} fromPreset={Boolean(research.presetId)} onChange={editCover} />
          <Editor page={page} ctx={ctx} sources={accepted} editorRef={editorRef} />
          {format === "note" && order.length > 0 && ready && (
            <section aria-label="Notes" className="mt-10 border-t border-hairline pt-4 text-sm">
              <h2 className="mb-2 font-display text-lg font-semibold">Notes</h2>
              <ol className="list-decimal space-y-1 pl-6">
                {order.map((c) => (
                  <li key={c.key}>{safe(() => citation(cited, c.refs, research.style))}</li>
                ))}
              </ol>
            </section>
          )}
          <section aria-label="References" className="mt-10 border-t border-hairline pt-4">
            <h2 className="mb-3 font-display text-xl font-semibold">{format === "note" ? "Bibliography" : "References"}</h2>
            {references ? (
              // citeproc escapes the metadata it formats, so this markup only carries its own tags
              <div className="references text-[15px]" dangerouslySetInnerHTML={{ __html: references }} />
            ) : (
              <p className="text-sm text-muted">Accept a source and press Cite here, or type /cite, and references appear here in {styleName(research.style)}.</p>
            )}
            {unused.length > 0 && (
              <p className="mt-4 text-xs text-muted">
                Accepted but not cited yet: {unused.map((s) => s.title).join("; ")}
              </p>
            )}
          </section>
        </article>
      </div>
    </CitationContext.Provider>
  );
}

// The cover page: any fields, edited in place. A dashed orange frame means it is still exactly as a preset filled it.
function Cover({ fields, fromPreset, onChange }: { fields: CoverField[]; fromPreset: boolean; onChange(fields: CoverField[]): void }) {
  const set = (i: number, patch: Partial<CoverField>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <section aria-label="Cover page" className={`mb-12 rounded-card p-6 text-center ${fromPreset ? "border-2 border-dashed border-spark" : "border border-transparent hover:border-hairline"}`}>
      {fields.map((f, i) => (
        <div key={i} className="group relative">
          <input
            value={f.value}
            onChange={(e) => set(i, { value: e.target.value.slice(0, 500) })}
            aria-label={f.label || "Cover field"}
            placeholder={f.label}
            className={`w-full bg-transparent text-center outline-none placeholder:text-muted ${i === 0 ? "font-display text-3xl font-semibold" : "text-base"}`}
          />
          {/* field name and remove sit in the margin, shown on hover or focus */}
          <input
            value={f.label}
            onChange={(e) => set(i, { label: e.target.value.slice(0, 100) })}
            aria-label="Field name"
            className="absolute top-1/2 left-0 w-20 -translate-y-1/2 bg-transparent text-xs text-muted opacity-0 outline-none group-hover:opacity-100 focus:opacity-100"
          />
          <button
            onClick={() => onChange(fields.filter((_, j) => j !== i))}
            aria-label={`Remove ${f.label || "field"}`}
            className="absolute top-1/2 right-0 -translate-y-1/2 text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...fields, { label: "Field", value: "" }])} className="mt-3 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
        <Plus size={12} strokeWidth={1.5} /> Add a field
      </button>
    </section>
  );
}
