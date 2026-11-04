import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { PINNED, styleName } from "@/lib/cite";
import type { CoverField, Page, Preset, Research } from "@/lib/schemas";
import { headingsOf } from "@/lib/starthere";

export const PAPER_SECTIONS = ["Abstract", "Introduction", "Literature review", "Method", "Findings", "Discussion", "Conclusion"];

const templateCover = (title: string): CoverField[] => [
  { label: "Title", value: title },
  { label: "Author", value: "" },
  { label: "Student ID", value: "" },
  { label: "Course", value: "" },
  { label: "Institution", value: "" },
  { label: "Date", value: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) },
];

// Every style id in the CSL repository's release branch, fetched once for search.
let allStyles: Promise<string[]> | undefined;
const styleIds = () =>
  (allStyles ??= fetch("https://api.github.com/repos/citation-style-language/styles/git/trees/v1.0.2")
    .then((r) => r.json())
    .then((d: { tree: { path: string }[] }) => d.tree.map((t) => t.path).filter((p) => p.endsWith(".csl")).map((p) => p.slice(0, -4)))
    .catch(() => {
      allStyles = undefined;
      return [];
    }));

export function StylePicker({ value, onChange }: { value: string; onChange(id: string): void }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<string[]>([]);

  useEffect(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "-");
    if (q.length < 2) return;
    let live = true;
    styleIds().then((ids) => live && setFound(ids.filter((id) => id.includes(q)).slice(0, 8)));
    return () => {
      live = false;
    };
  }, [query]);

  const chip = (id: string, name: string) => (
    <button
      key={id}
      type="button"
      role="radio"
      aria-checked={value === id}
      onClick={() => onChange(id)}
      className={`rounded-full px-3 py-1 text-sm ${value === id ? "bg-ink text-paper" : "border border-hairline hover:bg-sand"}`}
    >
      {name}
    </button>
  );

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Citation style" className="flex flex-wrap gap-2">
        {PINNED.map((s) => chip(s.id, s.name))}
        {!PINNED.some((s) => s.id === value) && chip(value, styleName(value))}
      </div>
      <label className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-sm">
        <Search size={14} strokeWidth={1.5} className="text-muted" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search any other CSL style, e.g. nature" className="min-w-0 flex-1 bg-transparent outline-none" />
      </label>
      {query.trim().length >= 2 && (
        <div className="flex flex-wrap gap-2">
          {found.map((id) => chip(id, id))}
          {!found.length && <span className="text-xs text-muted">No style matches.</span>}
        </div>
      )}
    </div>
  );
}

type Choice = { kind: "same" } | { kind: "preset"; preset: Preset } | { kind: "template" } | { kind: "blank" };

// The first screen of a new research page: a style, then a cover page.
export function ResearchStart({
  page,
  presets,
  lastPaper,
  onStart,
}: {
  page: Page;
  presets: Preset[];
  lastPaper?: Page;
  onStart(research: Research, sections: string[]): void;
}) {
  const [style, setStyle] = useState(lastPaper?.research?.style ?? presets[0]?.citationStyle ?? "apa");
  const [choice, setChoice] = useState<Choice>(lastPaper ? { kind: "same" } : presets[0] ? { kind: "preset", preset: presets[0] } : { kind: "template" });

  const start = () => {
    if (choice.kind === "same" && lastPaper?.research) return onStart({ style, cover: lastPaper.research.cover }, headingsOf(lastPaper.editorState));
    if (choice.kind === "preset") return onStart({ style, cover: choice.preset.fields, presetId: choice.preset.id }, choice.preset.sections);
    if (choice.kind === "template") return onStart({ style, cover: templateCover(page.title) }, PAPER_SECTIONS);
    onStart({ style, cover: [{ label: "Title", value: page.title }] }, []);
  };

  const option = (key: string, active: boolean, label: string, detail: string, pick: () => void) => (
    <button
      key={key}
      type="button"
      role="radio"
      aria-checked={active}
      onClick={pick}
      className={`rounded-card border p-3 text-left ${active ? "border-spark bg-spark-wash" : "border-hairline bg-surface hover:border-ink"}`}
    >
      <span className="block text-sm font-medium">{label}</span>
      <span className="block text-xs text-muted">{detail}</span>
    </button>
  );

  return (
    <section aria-label="Start your paper" className="mx-auto max-w-2xl space-y-8 px-8 py-10">
      <div>
        <h2 className="font-display text-3xl font-semibold">Start your paper</h2>
        <p className="mt-1 text-muted">Pick a citation style and a cover page. You can change both later.</p>
      </div>
      <div className="space-y-3">
        <h3 className="label">1. Citation style</h3>
        <StylePicker value={style} onChange={setStyle} />
      </div>
      <div className="space-y-3">
        <h3 className="label">2. Cover page</h3>
        {lastPaper && (
          <p className="text-sm">
            Use the same cover page as <span className="font-medium">{lastPaper.title || "your last paper"}</span>?
          </p>
        )}
        <div role="radiogroup" aria-label="Cover page" className="grid gap-2 sm:grid-cols-2">
          {lastPaper && option("same", choice.kind === "same", "Yes, the same cover page", `From ${lastPaper.title || "your last paper"}`, () => setChoice({ kind: "same" }))}
          {presets.map((p) =>
            option(p.id, choice.kind === "preset" && choice.preset.id === p.id, p.name, `${styleName(p.citationStyle)} · ${p.sections.length} sections`, () => setChoice({ kind: "preset", preset: p })),
          )}
          {option("template", choice.kind === "template", "Template", "Title, author, ID, course, institution, date", () => setChoice({ kind: "template" }))}
          {option("blank", choice.kind === "blank", "Blank", "Just a title", () => setChoice({ kind: "blank" }))}
        </div>
      </div>
      <button onClick={start} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper">
        Start writing
      </button>
    </section>
  );
}
