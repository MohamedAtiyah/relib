import type { ProjectFile } from "./sandbox";

export type CloudEvent =
  | { type: "info" | "stdout" | "stderr" | "error"; text: string }
  | { type: "exit"; code: number; files: ProjectFile[] };

const CAP_TEXT: Record<string, string> = {
  sandbox_off: "Needs the cloud runtime, which is not set up on this site.",
  sandbox_cap: "You've used today's cloud sandbox minutes. Come back tomorrow.",
  global_cap: "Relib's cloud sandbox budget for today is used up. Try again tomorrow.",
  rate_limited: "Too many runs. Wait a minute and try again.",
};

// Streams one command's output from the project's cloud sandbox. Abort the signal to stop it.
export async function runInCloud(project: string, command: string, files: ProjectFile[], onEvent: (e: CloudEvent) => void, signal?: AbortSignal) {
  let res: Response;
  try {
    res = await fetch("/api/sandbox/exec", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project, command, files }), signal });
  } catch {
    return onEvent({ type: "info", text: signal?.aborted ? "Stopped." : "Could not reach the cloud sandbox." });
  }
  if (!res.ok || !res.body) {
    const { error } = await res.json().catch(() => ({ error: "" }));
    return onEvent({ type: "error", text: CAP_TEXT[error] ?? "The cloud sandbox is unavailable right now." });
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const e of events) if (e.startsWith("data: ")) onEvent(JSON.parse(e.slice(6)));
    }
  } catch {
    onEvent({ type: "info", text: "Stopped." });
  }
}

// The default Run command for each compiled language, from the spec.
export const CLOUD_RUN: Record<string, { file: string; command: string }> = {
  c: { file: "main.c", command: "gcc main.c -o main && ./main" },
  cpp: { file: "main.cpp", command: "g++ -std=c++17 main.cpp -o main && ./main" },
  java: { file: "Main.java", command: "javac Main.java && java Main" },
  go: { file: "main.go", command: "(test -f go.mod || go mod init relib >/dev/null 2>&1) && go run ." },
  rust: { file: "src/main.rs", command: '(test -f Cargo.toml || printf "[package]\\nname = \\"relib\\"\\nversion = \\"0.1.0\\"\\nedition = \\"2021\\"\\n" > Cargo.toml) && cargo run -q' },
};
