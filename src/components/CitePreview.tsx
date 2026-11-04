import type { LexicalEditor } from "lexical";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import { errorText, post } from "@/lib/api";
import { bibliography, citation, ensureStyle, narrative, styleName } from "@/lib/cite";
import { citeAfter, highlight, sentencesOf } from "@/lib/citehere";
import { db } from "@/lib/db";
import type { Page, Source } from "@/lib/schemas";

const FIELDS = [
  ["venue", "Journal"],
  ["volume", "Volume"],
  ["issue", "Issue"],
  ["pages", "Pages"],
] as const;

const COLOURS = { orange: "#e07a2e", red: "#d64545" };

function savedColour(): keyof typeof COLOURS {
  try {
    return localStorage.getItem("relib:fit-colour") === "red" ? "red" : "orange";
  } catch {
    return "orange";
  }
}

type Fit = { sentence: number; reason: string };

// Shown after Accept on a research page: how to cite the source, and where in the paper it belongs.
export function CitePreview({ source, page, editorRef, onDone }: { source: Source; page: Page; editorRef: RefObject<LexicalEditor | null>; onDone(): void }) {
  const style = page.research?.style ?? "apa";
  const [loaded, setLoaded] = useState<{ style: string; format: string }>();
  const [fits, setFits] = useState<Fit[]>();
  const [error, setError] = useState<string | null>(null);
  const [cited, setCited] = useState<number[]>([]);
  const [colour, setColour] = useState(savedColour);
  const [sentences] = useState(() => sentencesOf(page.plainText));

  useEffect(() => {
    ensureStyle(style).then((format) => setLoaded({ style, format }), () => setError(`Could not load ${styleName(style)}.`));
  }, [style]);

  useEffect(() => {
    if (!sentences.length) return;
    let live = true;
    post<{ fits: Fit[] }>("fits", { sentences, source })
      .then((r) => live && setFits(r.fits))
      .catch((err) => live && setError(errorText(err)));
    return () => {
      live = false;
    };
  }, [sentences, source]);

  useEffect(() => {
    document.documentElement.style.setProperty("--fit-colour", COLOURS[colour]);
    try {
      localStorage.setItem("relib:fit-colour", colour);
    } catch {
      // the colour still applies for this visit
    }
  }, [colour]);

  // highlight the sentences in the paper; clear them when the card closes
  useEffect(() => {
    const root = editorRef.current?.getRootElement() ?? null;
    highlight(root, (fits ?? []).map((f) => sentences[f.sentence]));
    return () => highlight(root, []);
  }, [fits, sentences, editorRef]);

  const citeHere = async (fit: Fit) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (await citeAfter(editor, sentences[fit.sentence], { id: source.id })) setCited((c) => [...c, fit.sentence]);
    else setError("That sentence has changed since. Put your cursor where the citation goes and type /cite.");
  };

  const enter = (field: (typeof FIELDS)[number][0], value: string) =>
    db.sources.put({ ...source, [field]: value.trim().slice(0, field === "venue" ? 500 : 50) || undefined, entered: [...new Set([...(source.entered ?? []), field])] });

  const format = loaded?.style === style ? loaded.format : undefined;
  let entry = "";
  let inText = "";
  if (format) {
    try {
      entry = bibliography([source], style);
      inText = citation([source], [{ id: source.id }], style);
    } catch {
      // a style citeproc cannot run leaves the entry empty; the student can switch style
    }
  }

  return (
    <div className="space-y-4 text-sm">
      {/* the CSS build drops ::highlight(), so the rule ships with the component that uses it */}
      <style>{`::highlight(fit){background-color:var(--spark-wash);text-decoration:underline 2px var(--fit-colour,var(--spark))}`}</style>
      <button onClick={onDone} className="flex items-center gap-1 text-xs text-muted hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> Back to sources
      </button>
      <section className="rounded-card border border-hairline bg-surface p-4">
        <h3 className="label">Reference · {styleName(style)}</h3>
        {/* citeproc escapes the metadata it formats */}
        {entry ? <div className="references mt-2" dangerouslySetInnerHTML={{ __html: entry }} /> : <p className="mt-2 text-muted">Formatting…</p>}
        <h3 className="label mt-4">In text</h3>
        {format === "note" ? (
          <p className="mt-1">Footnote: {inText}</p>
        ) : (
          <ul className="mt-1 space-y-1">
            <li>Parenthetical: {inText}</li>
            <li>Narrative: {format ? narrative(source, inText, format as "numeric") : ""}</li>
          </ul>
        )}
        <h3 className="label mt-4">Details</h3>
        <dl className="mt-1 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1">
          {FIELDS.map(([field, label]) => (
            <div key={field} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd>
                <input
                  defaultValue={source[field] ?? ""}
                  onBlur={(e) => e.target.value !== (source[field] ?? "") && enter(field, e.target.value)}
                  placeholder="Missing: add it"
                  aria-label={label}
                  className="w-full bg-transparent outline-none placeholder:text-spark-ink"
                />
              </dd>
              <dd className="text-[11px] text-muted">{source[field] ? (source.entered?.includes(field) ? "entered by you" : "fetched") : ""}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="rounded-card border border-hairline bg-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="label">Where it fits</h3>
          <label className="flex items-center gap-1 text-xs text-muted">
            Highlight
            <select value={colour} onChange={(e) => setColour(e.target.value as keyof typeof COLOURS)} className="bg-transparent">
              <option value="orange">orange</option>
              <option value="red">red</option>
            </select>
          </label>
        </div>
        {!sentences.length && <p className="mt-2 text-muted">Write a few sentences first, then Relib can show where this source supports them.</p>}
        {sentences.length > 0 && !fits && !error && (
          <p className="mt-2 flex items-center gap-2 text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-spark" aria-hidden="true" /> Reading your paper…
          </p>
        )}
        {fits?.length === 0 && <p className="mt-2 text-muted">This source does not directly support any sentence yet.</p>}
        <ul className="mt-2 space-y-3">
          {fits?.map((f) => (
            <li key={f.sentence} className="border-l-2 pl-3" style={{ borderColor: COLOURS[colour] }}>
              <p className="italic">“{sentences[f.sentence]}”</p>
              <p className="mt-1 text-muted">{f.reason}</p>
              <button
                onClick={() => citeHere(f)}
                disabled={cited.includes(f.sentence)}
                className="mt-1 rounded-full bg-ink px-3 py-1 text-xs text-paper disabled:opacity-50"
              >
                {cited.includes(f.sentence) ? "Cited" : "Cite here"}
              </button>
            </li>
          ))}
        </ul>
        {error && <p role="alert" className="mt-2">{error}</p>}
      </section>
    </div>
  );
}
