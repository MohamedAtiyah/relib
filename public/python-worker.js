// Runs the user's own Python in this browser, away from the page. One worker per page, so cells share variables.
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";

const ready = loadPyodide().then(async (py) => {
  await py.runPythonAsync('import os\nos.environ["MPLBACKEND"] = "Agg"');
  return py;
});

// Figures matplotlib drew during a run, as PNG data, then closed.
const FIGURES = `
import sys, io, base64
_relib_figs = []
if "matplotlib.pyplot" in sys.modules:
    import matplotlib.pyplot as _relib_plt
    for _n in _relib_plt.get_fignums():
        _b = io.BytesIO()
        _relib_plt.figure(_n).savefig(_b, format="png", dpi=96, bbox_inches="tight")
        _relib_figs.append(base64.b64encode(_b.getvalue()).decode())
    _relib_plt.close("all")
_relib_figs
`;

self.onmessage = async ({ data: { id, code } }) => {
  let out = "";
  const log = [];
  const write = (line) => (out += `${line}\n`);
  let images = [];
  let error = false;
  try {
    const py = await ready;
    py.setStdout({ batched: write });
    py.setStderr({ batched: write });
    // `%pip install name` lines install pure-Python packages from PyPI through micropip
    const pips = [...code.matchAll(/^\s*%pip\s+install\s+(.+)$/gm)].flatMap((m) => m[1].trim().split(/\s+/));
    const body = code.replace(/^\s*%pip\s+install\s+.+$/gm, "");
    if (pips.length) {
      await py.loadPackage("micropip", { messageCallback: (m) => log.push(m) });
      const micropip = py.pyimport("micropip");
      for (const name of pips) {
        try {
          await micropip.install(name);
          log.push(`Installed ${name} from PyPI`);
        } catch (err) {
          log.push(`Could not install ${name}: ${String(err.message ?? err).split("\n").at(-2) ?? err}. Packages with native code may need the cloud sandbox.`);
        }
      }
    }
    await py.loadPackagesFromImports(body, { messageCallback: (m) => log.push(m) });
    const result = await py.runPythonAsync(body);
    if (result !== undefined) write(String(result));
    result?.destroy?.();
    const figs = await py.runPythonAsync(FIGURES);
    images = figs.toJs();
    figs.destroy();
  } catch (err) {
    error = true;
    const text = String(err.message ?? err).trim();
    write(text);
    const missing = text.match(/ModuleNotFoundError: No module named '([^']+)'/);
    if (missing) log.push(`${missing[1]} is not shipped with Pyodide. If it is pure Python, add "%pip install ${missing[1]}"; if it has native code, run it in the cloud sandbox.`);
  }
  self.postMessage({ id, output: out.slice(0, 20000), images: images.slice(0, 4), log, error });
};
