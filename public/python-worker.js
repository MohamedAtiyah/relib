// Runs the user's own Python in this browser, away from the page. A static module worker, so the CDN script is not bundled.
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";

const ready = loadPyodide();

self.onmessage = async ({ data: { id, code } }) => {
  let out = "";
  const write = (line) => (out += `${line}\n`);
  try {
    const py = await ready;
    py.setStdout({ batched: write });
    py.setStderr({ batched: write });
    await py.loadPackagesFromImports(code);
    const result = await py.runPythonAsync(code);
    if (result !== undefined) write(String(result));
    result?.destroy?.();
  } catch (err) {
    write(String(err.message ?? err).trim());
  }
  self.postMessage({ id, output: out.slice(0, 20000) });
};
