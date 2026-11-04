export type NotebookCell = { id: string; kind: "code" | "text"; source: string; output?: string; images?: string[]; error?: boolean };
export type ProjectFile = { path: string; content: string };
export type Program = { mode: "notebook"; cells: NotebookCell[] } | { mode: "project"; files: ProjectFile[]; open?: string[] };

const lines = (text: string) => text.split(/(?<=\n)/);

// Jupyter's nbformat 4, so notebooks move between Relib, Jupyter and Colab.
export function toIpynb(cells: NotebookCell[]) {
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: { kernelspec: { name: "python3", display_name: "Python 3", language: "python" }, language_info: { name: "python" } },
    cells: cells.map((c) =>
      c.kind === "text"
        ? { id: c.id, cell_type: "markdown", metadata: {}, source: lines(c.source) }
        : {
            id: c.id,
            cell_type: "code",
            metadata: {},
            execution_count: null,
            source: lines(c.source),
            outputs: [
              ...(c.output ? [{ output_type: "stream", name: c.error ? "stderr" : "stdout", text: lines(c.output) }] : []),
              ...(c.images ?? []).map((png) => ({ output_type: "display_data", metadata: {}, data: { "image/png": png } })),
            ],
          },
    ),
  };
}

type IpynbCell = { cell_type: string; source?: string | string[]; outputs?: { output_type: string; text?: string | string[]; data?: Record<string, string | string[]> }[] };
const join = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join("") : (v ?? ""));

export function fromIpynb(json: unknown): NotebookCell[] {
  const nb = json as { cells?: IpynbCell[] };
  if (!Array.isArray(nb?.cells)) throw new Error("Not a Jupyter notebook");
  return nb.cells
    .filter((c) => c.cell_type === "code" || c.cell_type === "markdown")
    .slice(0, 300)
    .map((c) => ({
      id: crypto.randomUUID(),
      kind: c.cell_type === "code" ? "code" : "text",
      source: join(c.source),
      output: (c.outputs ?? []).map((o) => join(o.text ?? o.data?.["text/plain"])).join("") || undefined,
      images: (c.outputs ?? []).flatMap((o) => (o.data?.["image/png"] ? [join(o.data["image/png"]).trim()] : [])),
    }));
}

// Runs a project's Python in the browser: every file is written to a folder first, so imports between files work.
export function pythonProjectScript(files: ProjectFile[], entry: string) {
  const py = files.filter((f) => !/\.(c|cpp|h|java|go|rs)$/.test(f.path));
  return `import os, runpy, sys, json
_files = json.loads(${JSON.stringify(JSON.stringify(Object.fromEntries(py.map((f) => [f.path, f.content]))))})
for _p, _c in _files.items():
    _full = os.path.join("/project", _p)
    os.makedirs(os.path.dirname(_full), exist_ok=True)
    with open(_full, "w") as _f:
        _f.write(_c)
os.chdir("/project")
if "/project" not in sys.path:
    sys.path.insert(0, "/project")
runpy.run_path(${JSON.stringify(entry)}, run_name="__main__")
`;
}

// A web project's index.html with its local CSS and JS inlined, for the sandboxed preview.
export function inlineWebProject(files: ProjectFile[]): string {
  const byPath = new Map(files.map((f) => [f.path.replace(/^\.\//, ""), f.content]));
  const html = byPath.get("index.html") ?? "<p>Add an index.html to preview.</p>";
  return html
    .replace(/<link[^>]+href=["']([^"':]+\.css)["'][^>]*>/gi, (tag, href) => (byPath.has(href) ? `<style>${byPath.get(href)}</style>` : tag))
    .replace(/<script([^>]*)src=["']([^"':]+\.js)["']([^>]*)><\/script>/gi, (tag, a, src, b) => (byPath.has(src) ? `<script${`${a}${b}`.trimEnd()}>${byPath.get(src)}</script>` : tag));
}
