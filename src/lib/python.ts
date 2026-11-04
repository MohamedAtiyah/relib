let worker: Worker | undefined;
let nextId = 0;

export function runPython(code: string): Promise<string> {
  const cold = !worker;
  worker ??= new Worker("/python-worker.js", { type: "module" });
  const running = worker;
  const id = nextId++;
  return new Promise((resolve) => {
    const stop = (output: string) => {
      clearTimeout(timer);
      running.removeEventListener("message", done);
      running.removeEventListener("error", failed);
      resolve(output);
    };
    // a loop that never ends would hold the worker forever; the first run also downloads Python
    const timer = setTimeout(() => {
      running.terminate();
      if (worker === running) worker = undefined;
      stop("Stopped: it ran too long.");
    }, cold ? 90_000 : 30_000);
    const done = ({ data }: MessageEvent<{ id: number; output: string }>) => data.id === id && stop(data.output);
    const failed = () => {
      if (worker === running) worker = undefined;
      stop("Python could not load. Check your connection and run again.");
    };
    running.addEventListener("message", done);
    running.addEventListener("error", failed);
    running.postMessage({ id, code });
  });
}
