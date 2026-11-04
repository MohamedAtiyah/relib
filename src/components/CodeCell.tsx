import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, type NodeKey } from "lexical";
import { Play, Square } from "lucide-react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { errorText, post } from "@/lib/api";
import { CLOUD_RUN, runInCloud } from "@/lib/cloud";
import { runJs } from "@/lib/jsrun";
import { detectLanguage, highlightCode, LANGUAGES, RUNTIME, type Language } from "@/lib/lang";
import { runPython, type RunResult } from "@/lib/python";
import { checkSchema, parseSchema, runSql, type SqlTable } from "@/lib/sqlrun";
import { PageIdContext } from "./Editor";
import type { CodeCellNode } from "./nodes";
import { SchemaDiagram } from "./SchemaDiagram";

export type CellData = {
  code: string;
  output: string;
  language?: Language;
  manual?: boolean; // the student picked the language, so detection stays off
  images?: string[];
  log?: string[];
  error?: boolean;
  tables?: SqlTable[];
  sqlMode?: "run" | "design";
};

// Line-level diff for "Show a fix", so the student sees exactly what would change.
function diffLines(before: string[], after: string[]) {
  const n = before.length;
  const m = after.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: { kind: " " | "-" | "+"; text: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && before[i] === after[j]) {
      out.push({ kind: " ", text: before[i] });
      i++;
      j++;
    } else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) {
      out.push({ kind: "+", text: after[j++] });
    } else {
      out.push({ kind: "-", text: before[i++] });
    }
  }
  return out;
}

export function CodeCell({ nodeKey, data }: { nodeKey: NodeKey; data: CellData }) {
  const [editor] = useLexicalComposerContext();
  const [running, setRunning] = useState(false);
  const [help, setHelp] = useState<string | null>(null);
  const [fix, setFix] = useState<{ explanation: string; code: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const page = useContext(PageIdContext);
  const stopper = useRef<AbortController | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [running]);
  const language: Language = data.language ?? "python";
  const runtime = RUNTIME[language];
  const design = language === "sql" && data.sqlMode === "design";

  const save = (patch: Partial<CellData>) => editor.update(() => ($getNodeByKey(nodeKey) as CodeCellNode | null)?.patch(patch));

  const edit = (code: string) => {
    const detected = data.manual ? null : detectLanguage(code);
    save({ code, ...(detected && detected !== language ? { language: detected } : {}) });
  };

  const run = async () => {
    setRunning(true);
    setHelp(null);
    setFix(null);
    let result: RunResult & { tables?: SqlTable[] } = { output: "" };
    if (runtime === "pyodide") result = await runPython(data.code, page);
    else if (runtime === "cloud") {
      // compiled languages run in the page's cloud sandbox; output streams in as it arrives
      const { file, command } = CLOUD_RUN[language];
      let output = "";
      let exit = 0;
      stopper.current = new AbortController();
      await runInCloud(
        `page:${page}`,
        command,
        [{ path: file, content: data.code }],
        (e) => {
          if (e.type === "exit") exit = e.code;
          else {
            output += e.type === "info" || e.type === "error" ? `[${e.text}]\n` : e.text;
            if (e.type === "error") exit = -1;
          }
          save({ output, error: false, images: undefined, tables: undefined, log: undefined });
        },
        stopper.current.signal,
      );
      result = { output: output || "(no output)", error: exit !== 0 };
    } else if (runtime === "js") result = await runJs(data.code, language === "typescript");
    else if (runtime === "sql" && !design) {
      const { tables, error } = await runSql(data.code);
      result = { output: error ?? (tables.length ? "" : "Done. No rows returned."), tables, error: Boolean(error) };
    } else if (design) {
      const error = await checkSchema(data.code);
      result = { output: error ? `Schema check: ${error}` : "Schema checked by SQLite in an empty database. No queries were run.", error: Boolean(error) };
    }
    save({ output: result.output, images: result.images, log: result.log, error: result.error, tables: result.tables });
    setRunning(false);
  };

  const ask = async (mode: "explain" | "fix") => {
    setAsking(true);
    try {
      const body = { mode, language: LANGUAGES[language], code: data.code, output: data.output };
      if (mode === "explain") setHelp((await post<{ explanation: string }>("code", body)).explanation);
      else setFix(await post<{ explanation: string; code: string }>("code", body));
    } catch (err) {
      setHelp(errorText(err));
    }
    setAsking(false);
  };

  const lines = data.code.split("\n");
  const highlighted = useMemo(() => (language === "html" ? highlightCode(data.code, "html") : highlightCode(data.code, language)), [data.code, language]);
  const schema = useMemo(() => (language === "sql" ? parseSchema(data.code) : []), [data.code, language]);
  const preview = runtime === "preview" && data.code.trim();

  return (
    <div className="code-surface my-2 overflow-hidden rounded-card border border-[var(--code-line)] not-prose">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--code-line)] px-3 py-1.5 font-sans text-xs text-[var(--code-muted)]">
        <select
          value={language}
          onChange={(e) => save({ language: e.target.value as Language, manual: true })}
          aria-label="Language"
          className="rounded-full bg-[var(--code-line)] px-2 py-0.5 text-[var(--code-fg)]"
        >
          {(Object.keys(LANGUAGES) as Language[]).map((l) => (
            <option key={l} value={l}>
              {LANGUAGES[l]}
            </option>
          ))}
        </select>
        {!data.manual && <span>detected</span>}
        {language === "sql" && (
          <span role="radiogroup" aria-label="SQL mode" className="flex rounded-full bg-[var(--code-line)] p-0.5">
            {(["run", "design"] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={(data.sqlMode ?? "run") === m}
                onClick={() => save({ sqlMode: m })}
                className={`rounded-full px-2 ${(data.sqlMode ?? "run") === m ? "bg-[var(--code-bg)] text-[var(--code-fg)]" : ""}`}
              >
                {m === "run" ? "Run" : "Design only"}
              </button>
            ))}
          </span>
        )}
        <span className="ml-auto" />
        {runtime === "cloud" && <span>Cloud sandbox</span>}
        {running && runtime === "cloud" && (
          <button onClick={() => stopper.current?.abort()} className="flex items-center gap-1 rounded-full border border-[var(--code-muted)] px-2.5 py-0.5">
            <Square size={10} strokeWidth={1.5} /> Stop · {seconds}s
          </button>
        )}
        {runtime !== "preview" && (
          <button
            onClick={run}
            disabled={running || !data.code.trim()}
            className="flex items-center gap-1 rounded-full bg-spark px-2.5 py-0.5 text-[#14161f] disabled:opacity-50"
          >
            <Play size={12} strokeWidth={1.5} /> {running ? "Running…" : design ? "Check" : "Run"}
          </button>
        )}
      </div>
      <div className="flex max-h-[28rem] overflow-auto text-sm leading-6">
        <div aria-hidden="true" className="shrink-0 py-2 pr-2 pl-3 text-right text-[var(--code-muted)] select-none">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* highlighted copy underneath; the textarea on top takes the typing */}
          <pre
            aria-hidden="true"
            className="hljs pointer-events-none m-0 bg-transparent py-2 pr-3 whitespace-pre"
            dangerouslySetInnerHTML={{ __html: `${highlighted}\n` }}
          />
          <textarea
            value={data.code}
            onChange={(e) => edit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey || e.shiftKey) && runtime !== "preview") {
                e.preventDefault();
                run();
              }
              if (e.key === "Tab") {
                e.preventDefault();
                const t = e.currentTarget;
                const at = t.selectionStart;
                edit(`${data.code.slice(0, at)}  ${data.code.slice(t.selectionEnd)}`);
                requestAnimationFrame(() => t.setSelectionRange(at + 2, at + 2));
              }
            }}
            aria-label={`${LANGUAGES[language]} code`}
            placeholder="Paste or type code. ⇧↵ runs it."
            spellCheck={false}
            wrap="off"
            className="absolute inset-0 resize-none overflow-hidden bg-transparent py-2 pr-3 whitespace-pre text-transparent caret-[var(--code-fg)] outline-none placeholder:text-[var(--code-muted)]"
          />
        </div>
      </div>
      {data.log && data.log.length > 0 && (
        <details className="border-t border-[var(--code-line)] px-3 py-1.5 font-sans text-xs text-[var(--code-muted)]">
          <summary className="cursor-pointer">Install log ({data.log.length})</summary>
          <pre className="mt-1 whitespace-pre-wrap">{data.log.join("\n")}</pre>
        </details>
      )}
      {preview && (
        <iframe
          title="Preview"
          sandbox="allow-scripts"
          srcDoc={
            language === "css" ? `<style>${data.code}</style><h1>Heading</h1><p>Paragraph with <a href="#">a link</a>.</p><button>Button</button>` : data.code
          }
          className="h-64 w-full border-t border-[var(--code-line)] bg-white"
        />
      )}
      {design && schema.length > 0 && <SchemaDiagram tables={schema} />}
      {(data.output || data.images?.length || data.tables?.length) && !preview ? (
        <div aria-label="Output" aria-live="polite" className="max-h-96 overflow-auto border-t border-[var(--code-line)] px-3 py-2 text-xs">
          {data.output && <pre className={`whitespace-pre-wrap ${data.error ? "text-[#f29a5a]" : ""}`}>{data.output}</pre>}
          {data.images?.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- a figure the student's own code drew
            <img key={i} src={`data:image/png;base64,${src}`} alt={`Figure ${i + 1}`} className="my-2 max-w-full rounded bg-white" />
          ))}
          {data.tables?.map((t, i) => (
            <table key={i} className="my-2 border-collapse">
              <thead>
                <tr>
                  {t.columns.map((c) => (
                    <th key={c} className="border border-[var(--code-line)] px-2 py-1 text-left">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.values.map((row, r) => (
                  <tr key={r}>
                    {row.map((v, c) => (
                      <td key={c} className="border border-[var(--code-line)] px-2 py-1">
                        {String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      ) : null}
      {data.error && data.code.trim() && !running && (
        <div className="space-y-2 border-t border-[var(--code-line)] px-3 py-2 font-sans text-xs">
          <div className="flex gap-2">
            <button
              onClick={() => ask("explain")}
              disabled={asking}
              className="rounded-full border border-[var(--code-muted)] px-2.5 py-0.5 disabled:opacity-50"
            >
              Explain this error
            </button>
            {
              <button onClick={() => ask("fix")} disabled={asking} className="rounded-full border border-[var(--code-muted)] px-2.5 py-0.5 disabled:opacity-50">
                Show a fix
              </button>
            }
            {asking && <span className="text-[var(--code-muted)]">Reading your code…</span>}
          </div>
          {help && <p className="whitespace-pre-wrap text-[var(--code-fg)]">{help}</p>}
          {fix && (
            <div className="space-y-2">
              <p className="text-[var(--code-fg)]">{fix.explanation}</p>
              <pre className="overflow-x-auto rounded bg-[var(--code-line)] p-2 font-mono">
                {diffLines(data.code.split("\n"), fix.code.split("\n")).map((d, i) => (
                  <div key={i} className={d.kind === "+" ? "text-[#7ee2a8]" : d.kind === "-" ? "text-[#f29a5a] line-through" : "text-[var(--code-muted)]"}>
                    {d.kind} {d.text}
                  </div>
                ))}
              </pre>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    save({ code: fix.code, error: false, output: "" });
                    setFix(null);
                  }}
                  className="rounded-full bg-spark px-2.5 py-0.5 text-[#14161f]"
                >
                  Accept fix
                </button>
                <button onClick={() => setFix(null)} className="rounded-full border border-[var(--code-muted)] px-2.5 py-0.5">
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
