import { Download, FilePlus, Pencil, Play, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { errorText, post } from "@/lib/api";
import { CLOUD_RUN, runInCloud } from "@/lib/cloud";
import { db } from "@/lib/db";
import { detectLanguage, LANGUAGES, RUNTIME, type Language } from "@/lib/lang";
import { fromIpynb, inlineWebProject, pythonProjectScript, toIpynb, type NotebookCell, type Program, type ProjectFile } from "@/lib/notebook";
import { restartPython, runPython } from "@/lib/python";
import type { Page } from "@/lib/schemas";
import { diffLines } from "./CodeCell";
import { CodeEditor } from "./CodeEditor";
import { TerminalPanel, type TerminalHandle } from "./TerminalPanel";

const STARTERS: Record<string, ProjectFile[]> = {
  "Web project": [
    { path: "index.html", content: '<!doctype html>\n<html>\n  <head>\n    <link rel="stylesheet" href="styles.css">\n  </head>\n  <body>\n    <h1>Hello</h1>\n    <button id="go">Click me</button>\n    <script src="app.js"></script>\n  </body>\n</html>\n' },
    { path: "styles.css", content: "body {\n  font-family: system-ui;\n  margin: 2rem;\n}\n" },
    { path: "app.js", content: 'document.getElementById("go").addEventListener("click", () => alert("Hi"));\n' },
    { path: "server.py", content: "from http.server import HTTPServer, SimpleHTTPRequestHandler\n\nHTTPServer((\"\", 8000), SimpleHTTPRequestHandler).serve_forever()\n" },
  ],
  Python: [{ path: "main.py", content: 'def greet(name):\n    return f"Hello, {name}"\n\nprint(greet("world"))\n' }],
  "C++": [{ path: "main.cpp", content: '#include <iostream>\n\nint main() {\n  std::cout << "Hello from C++" << std::endl;\n}\n' }],
  Blank: [{ path: "main.py", content: "" }],
};

const langOf = (path: string, content: string): Language | null => {
  const ext = path.split(".").pop()?.toLowerCase();
  const byExt: Record<string, Language> = { py: "python", js: "javascript", mjs: "javascript", ts: "typescript", sql: "sql", html: "html", css: "css", c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp", java: "java", go: "go", rs: "rust" };
  return (ext && byExt[ext]) || detectLanguage(content);
};

const save = (page: Page, program: Program) => {
  const summary =
    program.mode === "notebook"
      ? program.cells.map((c) => c.source).join("\n\n")
      : program.files.map((f) => `--- ${f.path}\n${f.content.slice(0, 3000)}`).join("\n");
  return db.pages.update(page.id, { program, plainText: summary.slice(0, 100_000), updatedAt: Date.now() });
};

export function Programming({ page }: { page: Page }) {
  const program = page.program;
  if (!program) {
    return (
      <section aria-label="New programming page" className="mx-auto max-w-2xl space-y-6 px-8 py-10">
        <div>
          <h2 className="font-display text-3xl font-semibold">Notebook or Project?</h2>
          <p className="mt-1 text-muted">A notebook is cells that share one Python session. A project is files, a terminal and the cloud sandbox for any language.</p>
        </div>
        <button onClick={() => save(page, { mode: "notebook", cells: [{ id: crypto.randomUUID(), kind: "code", source: "" }] })} className="block w-full rounded-card border border-hairline bg-surface p-4 text-left hover:border-ink">
          <span className="block font-medium">Notebook</span>
          <span className="text-sm text-muted">Code and text cells, run one or all, import and export .ipynb</span>
        </button>
        <div className="rounded-card border border-hairline bg-surface p-4">
          <span className="block font-medium">Project</span>
          <span className="text-sm text-muted">File tree, tabs and a terminal. Start from:</span>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(STARTERS).map(([name, files]) => (
              <button key={name} onClick={() => save(page, { mode: "project", files, open: [files[0].path] })} className="rounded-full border border-hairline px-3 py-1 text-sm hover:bg-sand">
                {name}
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }
  return program.mode === "notebook" ? <Notebook page={page} cells={program.cells} /> : <Project page={page} files={program.files} open={program.open ?? []} />;
}

function Notebook({ page, cells }: { page: Page; cells: NotebookCell[] }) {
  const [kernel, setKernel] = useState<"not started" | "idle" | "busy">("not started");
  const [busyCell, setBusyCell] = useState<string | null>(null);
  const latest = useRef(cells);
  useEffect(() => {
    latest.current = cells;
  });
  const write = (next: NotebookCell[]) => {
    latest.current = next;
    return save(page, { mode: "notebook", cells: next });
  };
  const patch = (id: string, p: Partial<NotebookCell>) => write(latest.current.map((c) => (c.id === id ? { ...c, ...p } : c)));

  const runCell = async (id: string) => {
    const cell = latest.current.find((c) => c.id === id);
    if (!cell || cell.kind !== "code" || !cell.source.trim()) return;
    setKernel("busy");
    setBusyCell(id);
    const r = await runPython(cell.source, page.id);
    await patch(id, { output: r.output, images: r.images, error: r.error });
    setBusyCell(null);
    setKernel("idle");
    return r;
  };
  const runAll = async () => {
    for (const c of latest.current) if (c.kind === "code" && (await runCell(c.id))?.error) break;
  };
  const restart = () => {
    restartPython(page.id);
    setKernel("not started");
    write(latest.current.map((c) => ({ ...c, output: undefined, images: undefined, error: undefined })));
  };
  const add = (at: number, kind: NotebookCell["kind"]) => write([...latest.current.slice(0, at), { id: crypto.randomUUID(), kind, source: "" }, ...latest.current.slice(at)]);

  const exportNb = () => {
    const blob = new Blob([JSON.stringify(toIpynb(latest.current), null, 1)], { type: "application/x-ipynb+json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(page.title || "notebook").replace(/[^\w-]+/g, "_")}.ipynb`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importNb = async (file: File) => {
    try {
      await write(fromIpynb(JSON.parse(await file.text())));
    } catch {
      window.alert("That file is not a Jupyter notebook.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-4">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="chip" title="The Python session shared by every cell on this page">
          Python · {kernel}
        </span>
        <button onClick={runAll} className="flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-xs text-paper">
          <Play size={12} strokeWidth={1.5} /> Run all
        </button>
        <button onClick={restart} className="flex items-center gap-1 rounded-full border border-hairline px-3 py-1 text-xs hover:bg-sand">
          <RotateCcw size={12} strokeWidth={1.5} /> Restart
        </button>
        <span className="ml-auto flex gap-2">
          <label className="flex cursor-pointer items-center gap-1 rounded-full border border-hairline px-3 py-1 text-xs hover:bg-sand">
            <Upload size={12} strokeWidth={1.5} /> Import .ipynb
            <input type="file" accept=".ipynb,application/json" hidden onChange={(e) => e.target.files?.[0] && importNb(e.target.files[0])} />
          </label>
          <button onClick={exportNb} className="flex items-center gap-1 rounded-full border border-hairline px-3 py-1 text-xs hover:bg-sand">
            <Download size={12} strokeWidth={1.5} /> Export .ipynb
          </button>
        </span>
      </div>
      {cells.map((cell, i) => (
        <div key={cell.id} className="group mb-3">
          {cell.kind === "code" ? (
            <div className="code-surface overflow-hidden rounded-card border border-[var(--code-line)]">
              <div className="flex items-center gap-2 border-b border-[var(--code-line)] px-3 py-1 font-sans text-xs text-[var(--code-muted)]">
                <span>[{busyCell === cell.id ? "*" : i + 1}]</span>
                <span className="ml-auto" />
                <button onClick={() => write(latest.current.filter((c) => c.id !== cell.id))} aria-label="Delete cell" className="opacity-0 group-hover:opacity-100">
                  <Trash2 size={12} strokeWidth={1.5} />
                </button>
                <button onClick={() => runCell(cell.id)} disabled={busyCell !== null} className="flex items-center gap-1 rounded-full bg-spark px-2.5 py-0.5 text-[#14161f] disabled:opacity-50">
                  <Play size={11} strokeWidth={1.5} /> Run
                </button>
              </div>
              <CodeEditor value={cell.source} language="python" onChange={(source) => patch(cell.id, { source })} onRun={() => runCell(cell.id)} />
              {(cell.output || cell.images?.length) && (
                <div className="max-h-96 overflow-auto border-t border-[var(--code-line)] px-3 py-2 text-xs">
                  {cell.output && <pre className={`whitespace-pre-wrap ${cell.error ? "text-[#f29a5a]" : ""}`}>{cell.output}</pre>}
                  {cell.images?.map((src, n) => (
                    // eslint-disable-next-line @next/next/no-img-element -- a figure the student's code drew
                    <img key={n} src={`data:image/png;base64,${src}`} alt={`Figure ${n + 1}`} className="my-2 max-w-full rounded bg-white" />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-card border border-transparent hover:border-hairline">
              <textarea
                value={cell.source}
                onChange={(e) => patch(cell.id, { source: e.target.value })}
                placeholder="Text cell: notes, explanations, # headings"
                aria-label="Text cell"
                rows={Math.max(2, cell.source.split("\n").length)}
                className={`w-full resize-none bg-transparent px-3 py-2 outline-none ${cell.source.startsWith("#") ? "font-display text-xl font-semibold" : ""}`}
              />
            </div>
          )}
          <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
            <button onClick={() => add(i + 1, "code")} className="flex items-center gap-1 text-xs text-muted hover:text-ink">
              <Plus size={12} strokeWidth={1.5} /> Code
            </button>
            <button onClick={() => add(i + 1, "text")} className="flex items-center gap-1 text-xs text-muted hover:text-ink">
              <Plus size={12} strokeWidth={1.5} /> Text
            </button>
          </div>
        </div>
      ))}
      {!cells.length && (
        <button onClick={() => add(0, "code")} className="text-sm text-muted underline">
          Add a code cell
        </button>
      )}
    </div>
  );
}

function Project({ page, files, open }: { page: Page; files: ProjectFile[]; open: string[] }) {
  const [active, setActive] = useState(open[0] ?? files[0]?.path);
  const [preview, setPreview] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ output: string } | null>(null);
  const [help, setHelp] = useState<string | null>(null);
  const [fix, setFix] = useState<{ explanation: string; code: string } | null>(null);
  const term = useRef<TerminalHandle>(null);
  const stopper = useRef<AbortController | null>(null);
  const latest = useRef({ files, open });
  useEffect(() => {
    latest.current = { files, open };
  });

  const write = (next: Partial<{ files: ProjectFile[]; open: string[] }>) => {
    latest.current = { ...latest.current, ...next };
    return save(page, { mode: "project", ...latest.current });
  };
  const file = files.find((f) => f.path === active);
  const language = file ? langOf(file.path, file.content) : null;
  const web = files.some((f) => f.path === "index.html");
  const compiled = files.some((f) => /\.(c|cc|cpp|java|go|rs)$/.test(f.path));

  const openFile = (path: string) => {
    setActive(path);
    if (!latest.current.open.includes(path)) write({ open: [...latest.current.open, path] });
  };
  const newFile = () => {
    const path = window.prompt("New file path (folders with /), e.g. src/utils.py")?.trim();
    if (!path || latest.current.files.some((f) => f.path === path) || path.includes("..") || path.startsWith("/")) return;
    write({ files: [...latest.current.files, { path, content: "" }] });
    openFile(path);
  };
  const rename = (path: string) => {
    const next = window.prompt("Rename or move to", path)?.trim();
    if (!next || next === path || next.includes("..") || next.startsWith("/") || latest.current.files.some((f) => f.path === next)) return;
    write({ files: latest.current.files.map((f) => (f.path === path ? { ...f, path: next } : f)), open: latest.current.open.map((p) => (p === path ? next : p)) });
    if (active === path) setActive(next);
  };
  const remove = (path: string) => {
    if (!window.confirm(`Delete ${path}?`)) return;
    write({ files: latest.current.files.filter((f) => f.path !== path), open: latest.current.open.filter((p) => p !== path) });
    if (active === path) setActive(latest.current.open[0]);
  };
  const removeFolder = (folder: string) => {
    if (!window.confirm(`Delete the folder ${folder} and everything in it?`)) return;
    write({ files: latest.current.files.filter((f) => !f.path.startsWith(`${folder}/`)), open: latest.current.open.filter((p) => !p.startsWith(`${folder}/`)) });
  };
  const edit = (content: string) => write({ files: latest.current.files.map((f) => (f.path === active ? { ...f, content } : f)) });

  // The terminal: Python and web commands run in the browser, everything else in the cloud sandbox.
  const runCommand = async (command: string) => {
    setFailed(null);
    setHelp(null);
    setFix(null);
    const t = term.current;
    const py = command.match(/^python3?\s+(\S+\.py)\s*$/);
    const pip = command.match(/^pip3?\s+install\s+(.+)$/);
    if (web && /^(open|preview)\b/.test(command)) {
      setPreview(inlineWebProject(latest.current.files));
      t?.write("Preview opened.");
      return t?.prompt();
    }
    if ((py || pip) && !compiled) {
      const r = await runPython(pip ? `%pip install ${pip[1]}\nprint("done")` : pythonProjectScript(latest.current.files, py![1]), page.id);
      for (const line of r.log ?? []) t?.write(`${line}\n`);
      t?.write(r.output);
      if (r.error) setFailed({ output: r.output });
      return t?.prompt();
    }
    let output = "";
    let code = 0;
    stopper.current = new AbortController();
    await runInCloud(
      `project:${page.id}`,
      command,
      latest.current.files,
      (e) => {
        if (e.type === "exit") {
          code = e.code;
          if (e.files.length) {
            // files the run created or changed come back into the project
            const merged = new Map(latest.current.files.map((f) => [f.path, f]));
            for (const f of e.files) merged.set(f.path, f);
            write({ files: [...merged.values()] });
          }
        } else {
          const text = e.type === "info" || e.type === "error" ? `\x1b[2m${e.text}\x1b[0m\n` : e.text;
          output += e.type === "info" ? "" : e.text;
          t?.write(text);
          if (e.type === "error") code = -1;
        }
      },
      stopper.current.signal,
    );
    stopper.current = null;
    if (code !== 0) {
      t?.write(`\x1b[2m(exit ${code})\x1b[0m`);
      setFailed({ output });
    } else if (/(npm install|apt-get install|pip install|cargo add)/.test(command)) t?.write("\x1b[32mInstalled.\x1b[0m");
    t?.prompt();
  };

  // Run picks the command for the open file's language and types it into the terminal
  const run = () => {
    if (!file || !language) return;
    const cloud = CLOUD_RUN[language];
    const command =
      RUNTIME[language] === "preview" ? "preview" : language === "python" ? `python ${file.path}` : cloud ? cloud.command.replace(cloud.file, file.path) : `node ${file.path}`;
    term.current?.write(`${command}\n`);
    return runCommand(command);
  };

  const ask = async (mode: "explain" | "fix") => {
    if (!file || !failed) return;
    try {
      const body = { mode, language: language ? LANGUAGES[language] : "code", code: file.content, output: failed.output };
      if (mode === "explain") setHelp((await post<{ explanation: string }>("code", body)).explanation);
      else setFix(await post<{ explanation: string; code: string }>("code", body));
    } catch (err) {
      setHelp(errorText(err));
    }
  };

  // folders are implied by paths; the tree shows them once each
  const folders = [...new Set(files.flatMap((f) => f.path.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"))))].sort();
  const rows = [...folders.map((path) => ({ path, folder: true })), ...files.map((f) => ({ path: f.path, folder: false }))].sort((a, b) => a.path.localeCompare(b.path));

  return (
    <div className="code-surface flex h-full min-h-[70vh] min-w-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Project files" className="w-52 shrink-0 overflow-y-auto border-r border-[var(--code-line)] py-2 font-sans text-xs">
          <div className="flex items-center justify-between px-3 pb-2 text-[var(--code-muted)]">
            <span className="tracking-wide uppercase">Files</span>
            <button onClick={newFile} aria-label="New file" title="New file">
              <FilePlus size={14} strokeWidth={1.5} />
            </button>
          </div>
          <ul>
            {rows.map(({ path, folder }) => (
              <li key={path} className="group flex items-center gap-1 px-2" style={{ paddingLeft: 8 + 10 * (path.split("/").length - 1) }}>
                {folder ? (
                  <span className="flex-1 truncate py-1 text-[var(--code-muted)]">{path.split("/").pop()}/</span>
                ) : (
                  <button onClick={() => openFile(path)} className={`flex-1 truncate rounded py-1 text-left ${path === active ? "text-[#f29a5a]" : ""}`}>
                    {path.split("/").pop()}
                  </button>
                )}
                {!folder && (
                  <button onClick={() => rename(path)} aria-label={`Rename ${path}`} className="opacity-0 group-hover:opacity-100">
                    <Pencil size={11} strokeWidth={1.5} />
                  </button>
                )}
                <button onClick={() => (folder ? removeFolder(path) : remove(path))} aria-label={`Delete ${path}`} className="opacity-0 group-hover:opacity-100">
                  <Trash2 size={11} strokeWidth={1.5} />
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center border-b border-[var(--code-line)] font-sans text-xs">
            <div role="tablist" className="flex min-w-0 flex-1 overflow-x-auto">
              {open
                .filter((p) => files.some((f) => f.path === p))
                .map((p) => (
                  <span key={p} role="tab" aria-selected={p === active} className={`flex shrink-0 items-center gap-1 border-r border-[var(--code-line)] px-3 py-1.5 ${p === active ? "bg-[var(--code-line)]" : "text-[var(--code-muted)]"}`}>
                    <button onClick={() => setActive(p)}>{p.split("/").pop()}</button>
                    <button onClick={() => write({ open: latest.current.open.filter((o) => o !== p) })} aria-label={`Close ${p}`}>
                      <X size={11} strokeWidth={1.5} />
                    </button>
                  </span>
                ))}
            </div>
            {language && <span className="px-2 text-[var(--code-muted)]">{LANGUAGES[language]}</span>}
            <button onClick={run} disabled={!file} className="mx-2 flex items-center gap-1 rounded-full bg-spark px-2.5 py-0.5 text-[#14161f] disabled:opacity-50">
              <Play size={11} strokeWidth={1.5} /> Run
            </button>
          </div>
          {file ? (
            <CodeEditor value={file.content} language={language} onChange={edit} onRun={run} className="min-h-0 flex-1" />
          ) : (
            <p className="p-4 font-sans text-sm text-[var(--code-muted)]">Open a file from the tree.</p>
          )}
          {preview && (
            <div className="relative h-64 border-t border-[var(--code-line)]">
              <button onClick={() => setPreview(null)} aria-label="Close preview" className="absolute top-1 right-1 rounded bg-[var(--code-line)] p-1">
                <X size={12} strokeWidth={1.5} />
              </button>
              <iframe title="Preview" sandbox="allow-scripts allow-modals" srcDoc={preview} className="h-full w-full bg-white" />
            </div>
          )}
        </div>
      </div>
      {failed && file && (
        <div className="space-y-2 border-t border-[var(--code-line)] px-3 py-2 font-sans text-xs">
          <div className="flex gap-2">
            <button onClick={() => ask("explain")} className="rounded-full border border-[var(--code-muted)] px-2.5 py-0.5">
              Explain this error
            </button>
            <button onClick={() => ask("fix")} className="rounded-full border border-[var(--code-muted)] px-2.5 py-0.5">
              Show a fix for {file.path}
            </button>
          </div>
          {help && <p className="whitespace-pre-wrap">{help}</p>}
          {fix && (
            <div className="space-y-2">
              <p>{fix.explanation}</p>
              <pre className="max-h-48 overflow-auto rounded bg-[var(--code-line)] p-2 font-mono">
                {diffLines(file.content.split("\n"), fix.code.split("\n")).map((d, n) => (
                  <div key={n} className={d.kind === "+" ? "text-[#7ee2a8]" : d.kind === "-" ? "text-[#f29a5a] line-through" : "text-[var(--code-muted)]"}>
                    {d.kind} {d.text}
                  </div>
                ))}
              </pre>
              <button
                onClick={() => {
                  edit(fix.code);
                  setFix(null);
                  setFailed(null);
                }}
                className="rounded-full bg-spark px-2.5 py-0.5 text-[#14161f]"
              >
                Accept fix
              </button>
            </div>
          )}
        </div>
      )}
      <div className="h-56 shrink-0 border-t border-[var(--code-line)]">
        <TerminalPanel ref={term} onCommand={runCommand} onInterrupt={() => stopper.current?.abort()} />
      </div>
    </div>
  );
}
