import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createTextNode, $getNodeByKey, type NodeKey } from "lexical";
import { Calculator, Keyboard, Search, Shapes } from "lucide-react";
import type { MathfieldElement } from "mathlive";
import { useEffect, useMemo, useRef, useState } from "react";
import { errorText, post } from "@/lib/api";
import { PALETTE, renderTex, SHORTCUTS } from "@/lib/math";
import { OPERATIONS, solveWithSympy, type Operation } from "@/lib/sympy";
import { $createMathNode, type MathData, type MathNode } from "./nodes";

const FONTS = "https://cdn.jsdelivr.net/npm/mathlive@0.111.4/fonts";

// Equations that should open for editing as soon as they appear (typed with $ or inserted with /math).
export const OPEN_ON_MOUNT = new Set<NodeKey>();

function Tex({ latex, display }: { latex: string; display: boolean }) {
  const { html, error } = useMemo(() => renderTex(latex, display), [latex, display]);
  if (error) return <code className="text-spark-ink">{latex}</code>;
  // KaTeX builds this markup itself from the LaTeX
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// Plain-language explanation with $...$ maths rendered inline.
function Prose({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap">
      {text.split(/(\$[^$]+\$)/).map((part, i) => (part.startsWith("$") && part.endsWith("$") && part.length > 2 ? <Tex key={i} latex={part.slice(1, -1)} display={false} /> : part))}
    </p>
  );
}

export function MathBlock({ nodeKey, data }: { nodeKey: NodeKey; data: MathData }) {
  const [editor] = useLexicalComposerContext();
  const [editing, setEditing] = useState(() => OPEN_ON_MOUNT.delete(nodeKey));
  const save = (patch: Partial<MathData>) => editor.update(() => ($getNodeByKey(nodeKey) as MathNode | null)?.patch(patch));

  if (!editing) {
    const empty = !data.latex.trim();
    const body = (
      <button type="button" onClick={() => setEditing(true)} title="Edit equation" className={empty ? "rounded bg-sand px-1 text-muted" : "rounded hover:bg-sand"}>
        {empty ? "equation" : <Tex latex={data.latex} display={data.display} />}
      </button>
    );
    if (!data.display) return body;
    return (
      <div className="my-3">
        <div className="text-center">{body}</div>
        {data.solved && <Solved data={data} />}
      </div>
    );
  }
  return <MathEditor data={data} nodeKey={nodeKey} onSave={save} onClose={() => setEditing(false)} />;
}

function Solved({ data }: { data: MathData }) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const solved = data.solved!;
  const explain = async () => {
    setBusy(true);
    try {
      setExplanation((await post<{ explanation: string }>("math", { mode: "explain", latex: data.latex, operation: OPERATIONS[solved.op], result: solved.result })).explanation);
    } catch (err) {
      setExplanation(errorText(err));
    }
    setBusy(false);
  };
  return (
    <div className="mx-auto mt-2 max-w-xl rounded-card border border-hairline bg-surface p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="label">{OPERATIONS[solved.op]}</span>
        <span className="chip">Checked by SymPy</span>
      </div>
      <div className="mt-2 text-center">
        <Tex latex={solved.result} display />
      </div>
      {explanation ? (
        <div className="mt-2 border-t border-hairline pt-2">
          <Prose text={explanation} />
        </div>
      ) : (
        <button onClick={explain} disabled={busy} className="mt-2 text-xs text-muted underline hover:text-ink">
          {busy ? "Explaining…" : "Explain the steps"}
        </button>
      )}
    </div>
  );
}

function MathEditor({ data, nodeKey, onSave, onClose }: { data: MathData; nodeKey: NodeKey; onSave(patch: Partial<MathData>): void; onClose(): void }) {
  const [editor] = useLexicalComposerContext();
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<MathfieldElement | null>(null);
  const [latex, setLatex] = useState(data.latex);
  const [panel, setPanel] = useState<"words" | "symbols" | "solve" | null>(null);

  // remove an empty inline equation and give back the $ the student typed
  const cancelEmpty = () =>
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!node) return;
      if (!data.display) node.insertBefore($createTextNode("$"));
      node.remove();
    });

  const done = (value = field.current?.getValue("latex") ?? latex) => {
    if (!value.trim()) return cancelEmpty();
    onSave({ latex: value });
    onClose();
  };

  // $ typed into an empty inline equation turns it into a display equation, as $$ does in LaTeX
  const toDisplay = () =>
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!node) return;
      const display = $createMathNode({ latex: "", display: true });
      node.getTopLevelElementOrThrow().insertAfter(display);
      OPEN_ON_MOUNT.add(display.getKey());
      node.remove();
    });

  useEffect(() => {
    let mf: MathfieldElement | undefined;
    let live = true;
    import("mathlive").then(({ MathfieldElement }) => {
      if (!live || !host.current) return;
      MathfieldElement.fontsDirectory = FONTS;
      MathfieldElement.soundsDirectory = null;
      mf = new MathfieldElement();
      mf.className = "w-full rounded-lg border border-hairline bg-surface px-2 py-1 text-xl";
      host.current.append(mf); // MathLive reads and writes options only once the field is in the page
      mf.value = data.latex;
      mf.inlineShortcuts = { ...mf.inlineShortcuts, ...SHORTCUTS };
      mf.mathVirtualKeyboardPolicy = "manual";
      mf.addEventListener("input", () => setLatex(mf!.getValue("latex")));
      mf.addEventListener("keydown", (e) => {
        if (e.key === "$" && !mf!.getValue("latex").trim() && !data.display) {
          e.preventDefault();
          toDisplay();
        } else if (e.key === "Escape") {
          e.preventDefault();
          done(mf!.getValue("latex"));
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          done(mf!.getValue("latex"));
        }
      });
      field.current = mf;
      requestAnimationFrame(() => mf?.focus());
    });
    return () => {
      live = false;
      mf?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the field is created once per edit
  }, []);

  const insert = (tex: string) => {
    field.current?.insert(tex.replace(/#\?/g, "#?"), { selectionMode: "placeholder", focus: true });
    setLatex(field.current?.getValue("latex") ?? latex);
  };

  const tool = (name: typeof panel, label: string, Icon: typeof Search) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setPanel(panel === name ? null : name)}
      aria-pressed={panel === name}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${panel === name ? "bg-ink text-paper" : "border border-hairline hover:bg-sand"}`}
    >
      <Icon size={13} strokeWidth={1.5} /> {label}
    </button>
  );

  return (
    <span className={`${data.display ? "my-3 block" : "inline-block align-middle"} w-full max-w-xl rounded-card border border-spark bg-paper p-2 text-sm`}>
      <span ref={host} className="block" />
      <span className="mt-2 flex flex-wrap items-center gap-1.5">
        {tool("words", "Say it in words", Search)}
        {tool("symbols", "Symbols", Shapes)}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const kb = (window as unknown as { mathVirtualKeyboard?: { visible: boolean; show(): void; hide(): void } }).mathVirtualKeyboard;
            if (kb?.visible) kb.hide();
            else kb?.show();
            field.current?.focus();
          }}
          className="flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-xs hover:bg-sand"
        >
          <Keyboard size={13} strokeWidth={1.5} /> Keyboard
        </button>
        {data.display && tool("solve", "Solve", Calculator)}
        <span className="ml-auto flex gap-1.5">
          <button type="button" onClick={() => navigator.clipboard.writeText(field.current?.getValue("latex") ?? latex)} className="text-xs text-muted hover:text-ink">
            Copy LaTeX
          </button>
          <button type="button" onClick={() => navigator.clipboard.writeText(field.current?.getValue("math-ml") ?? "")} className="text-xs text-muted hover:text-ink">
            Copy MathML
          </button>
          <button type="button" onClick={() => done()} className="rounded-full bg-ink px-3 py-1 text-xs text-paper">
            Done
          </button>
        </span>
      </span>
      {panel === "words" && <Words onInsert={(tex) => (field.current ? ((field.current.value = tex), setLatex(tex), done(tex)) : null)} />}
      {panel === "symbols" && <Palette onPick={insert} />}
      {panel === "solve" && (
        <Solve
          latex={latex}
          session={editor.getKey()}
          onSolved={(solved) => {
            onSave({ latex, solved });
            onClose();
          }}
        />
      )}
      <span className="mt-1 block text-[11px] text-muted">Type alpha, -&gt;, &lt;=, sqrt(, 1/2 and they convert. \ opens every LaTeX command. Enter to finish.</span>
    </span>
  );
}

// Way 1: say it in English. Shown as a preview and inserted only on Enter.
function Words({ onInsert }: { onInsert(tex: string): void }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ latex: string; symbols: { symbol: string; meaning: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await post("math", { mode: "english", text }));
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  };

  return (
    <span className="mt-2 block rounded-lg bg-sand p-2">
      <input
        autoFocus
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (result) onInsert(result.latex);
          else if (text.trim()) ask();
        }}
        placeholder="e.g. force equals mass times acceleration, then Enter"
        aria-label="Describe the equation in words"
        className="w-full rounded-lg border border-hairline bg-surface px-2 py-1"
      />
      {busy && <span className="mt-1 block text-xs text-muted">Writing it as an equation…</span>}
      {error && <span className="mt-1 block text-xs">{error}</span>}
      {result && (
        <span className="mt-2 block">
          <span className="block text-center text-lg">
            <Tex latex={result.latex} display />
          </span>
          {result.symbols.length > 0 && (
            <span className="mt-1 block text-xs text-muted">{result.symbols.map((s) => `${s.symbol}: ${s.meaning}`).join(" · ")}</span>
          )}
          <span className="mt-1 block text-xs">Press Enter to insert it.</span>
        </span>
      )}
    </span>
  );
}

function Palette({ onPick }: { onPick(tex: string): void }) {
  const groups = useMemo(() => [...new Set(PALETTE.map((s) => s.group))], []);
  const [group, setGroup] = useState(groups[0]);
  const [query, setQuery] = useState("");
  const shown = query.trim() ? PALETTE.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 40) : PALETTE.filter((s) => s.group === group);
  return (
    <span className="mt-2 block rounded-lg bg-sand p-2">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a symbol by name, e.g. integral" aria-label="Find a symbol" className="w-full rounded-lg border border-hairline bg-surface px-2 py-1" />
      {!query.trim() && (
        <span role="tablist" className="mt-2 flex flex-wrap gap-1">
          {groups.map((g) => (
            <button key={g} type="button" role="tab" aria-selected={g === group} onClick={() => setGroup(g)} className={`rounded-full px-2 py-0.5 text-[11px] ${g === group ? "bg-ink text-paper" : "bg-surface"}`}>
              {g}
            </button>
          ))}
        </span>
      )}
      <span className="mt-2 grid max-h-48 grid-cols-6 gap-1 overflow-y-auto">
        {shown.map((s) => (
          <button key={`${s.group}-${s.name}`} type="button" title={s.name} aria-label={s.name} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(s.latex)} className="flex h-10 items-center justify-center overflow-hidden rounded bg-surface hover:bg-spark-wash">
            <Tex latex={s.latex} display={false} />
          </button>
        ))}
      </span>
    </span>
  );
}

function Solve({ latex, session, onSolved }: { latex: string; session: string; onSolved(solved: NonNullable<MathData["solved"]>): void }) {
  const [op, setOp] = useState<Operation>("solve");
  const [variable, setVariable] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [state, setState] = useState<string | null>(null);

  const run = async () => {
    setState("SymPy is working it out… (the first time loads Python)");
    const result = await solveWithSympy(latex, op, session, { variable: variable.trim() || undefined, a, b });
    if (result.latex) {
      onSolved({ op, result: result.latex });
      setState(null);
    } else setState(`SymPy could not do this: ${result.error}`);
  };

  return (
    <span className="mt-2 block space-y-2 rounded-lg bg-sand p-2 text-xs">
      <span className="flex flex-wrap items-center gap-2">
        <select value={op} onChange={(e) => setOp(e.target.value as Operation)} aria-label="Operation" className="rounded border border-hairline bg-surface px-1 py-0.5">
          {(Object.keys(OPERATIONS) as Operation[]).map((o) => (
            <option key={o} value={o}>
              {OPERATIONS[o]}
            </option>
          ))}
        </select>
        {["solve", "diff", "integrate", "definite", "limit"].includes(op) && (
          <input value={variable} onChange={(e) => setVariable(e.target.value.slice(0, 10))} placeholder="variable (x)" aria-label="Variable" className="w-24 rounded border border-hairline bg-surface px-1 py-0.5" />
        )}
        {(op === "definite" || op === "limit") && (
          <input value={a} onChange={(e) => setA(e.target.value)} placeholder={op === "limit" ? "approaches" : "from"} aria-label={op === "limit" ? "Limit point" : "Lower bound"} className="w-20 rounded border border-hairline bg-surface px-1 py-0.5" />
        )}
        {op === "definite" && <input value={b} onChange={(e) => setB(e.target.value)} placeholder="to" aria-label="Upper bound" className="w-20 rounded border border-hairline bg-surface px-1 py-0.5" />}
        <button type="button" onClick={run} className="rounded-full bg-ink px-3 py-0.5 text-paper">
          Compute
        </button>
      </span>
      {state && <span className="block">{state}</span>}
      <span className="block text-muted">Computed by SymPy in your browser. The AI only explains the steps afterwards.</span>
    </span>
  );
}
