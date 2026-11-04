import { transform } from "sucrase";
import type { RunResult } from "./python";

// Bare npm imports load as ES modules from esm.sh, so `import _ from "lodash"` just works.
export function resolveImports(code: string): { code: string; packages: string[] } {
  const packages = new Set<string>();
  const rewrite = (spec: string) => {
    if (/^(\.|\/|https?:)/.test(spec)) return spec;
    packages.add(spec);
    return `https://esm.sh/${spec}`;
  };
  const out = code
    .replace(/(\bfrom\s*)(["'])([^"']+)\2/g, (_, from, q, spec) => `${from}${q}${rewrite(spec)}${q}`)
    .replace(/(\bimport\s*)(["'])([^"']+)\2/g, (_, imp, q, spec) => `${imp}${q}${rewrite(spec)}${q}`)
    .replace(/(\bimport\s*\(\s*)(["'])([^"']+)\2/g, (_, imp, q, spec) => `${imp}${q}${rewrite(spec)}${q}`);
  return { code: out, packages: [...packages] };
}

// The worker that runs the user's module: console output is collected and sent back.
const RUNNER = `
const lines = [];
const show = (v) => typeof v === "string" ? v : (() => { try { return JSON.stringify(v, null, 2) ?? String(v); } catch { return String(v); } })();
for (const k of ["log", "info", "warn", "error"]) console[k] = (...a) => lines.push(a.map(show).join(" "));
self.onmessage = async ({ data }) => {
  try {
    await import(data);
    await new Promise((r) => setTimeout(r, 300)); // let timers and promises finish printing
    postMessage({ output: lines.join("\\n") });
  } catch (err) {
    postMessage({ output: lines.concat(String(err?.stack ?? err)).join("\\n"), error: true });
  }
};`;

export function runJs(code: string, typescript: boolean): Promise<RunResult> {
  let source = code;
  try {
    if (typescript) source = transform(code, { transforms: ["typescript"] }).code;
  } catch (err) {
    return Promise.resolve({ output: String(err), error: true });
  }
  const { code: module, packages } = resolveImports(source);
  const log = packages.map((p) => `Fetched ${p} from esm.sh`);
  const moduleUrl = URL.createObjectURL(new Blob([module], { type: "text/javascript" }));
  const runnerUrl = URL.createObjectURL(new Blob([RUNNER], { type: "text/javascript" }));
  const worker = new Worker(runnerUrl, { type: "module" });
  return new Promise((resolve) => {
    const finish = (result: RunResult) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(moduleUrl);
      URL.revokeObjectURL(runnerUrl);
      resolve({ ...result, log });
    };
    const timer = setTimeout(() => finish({ output: "Stopped: it ran longer than 20 seconds.", error: true }), 20_000);
    worker.onmessage = ({ data }) => finish(data);
    worker.onerror = (e) => finish({ output: e.message || "The code could not start.", error: true });
    worker.postMessage(moduleUrl);
  });
}
