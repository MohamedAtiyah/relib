export type RunResult = { output: string; images?: string[]; log?: string[]; error?: boolean };

// One Python session per page: blocks on the same page share variables, like notebook cells.
const sessions = new Map<string, Worker>();
let nextId = 0;

export function restartPython(session: string) {
  sessions.get(session)?.terminate();
  sessions.delete(session);
}

export function runPython(code: string, session = "default"): Promise<RunResult> {
  const cold = !sessions.has(session);
  if (cold) sessions.set(session, new Worker("/python-worker.js", { type: "module" }));
  const running = sessions.get(session)!;
  const id = nextId++;
  return new Promise((resolve) => {
    const stop = (result: RunResult) => {
      clearTimeout(timer);
      running.removeEventListener("message", done);
      running.removeEventListener("error", failed);
      resolve(result);
    };
    // a loop that never ends would hold the session forever; the first run also downloads Python
    const timer = setTimeout(() => {
      restartPython(session);
      stop({ output: "Stopped: it ran too long. The session was restarted, so variables are cleared.", error: true });
    }, cold ? 120_000 : 60_000);
    const done = ({ data }: MessageEvent<RunResult & { id: number }>) => data.id === id && stop(data);
    const failed = () => {
      restartPython(session);
      stop({ output: "Python could not load. Check your connection and run again.", error: true });
    };
    running.addEventListener("message", done);
    running.addEventListener("error", failed);
    running.postMessage({ id, code });
  });
}
