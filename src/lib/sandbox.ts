import { Sandbox } from "e2b";
import { sql } from "./sql";

// Compiled languages and full installs run in an isolated E2B sandbox, one per project, never on Relib's server.

export const ROOT = "/home/user/project";
export const IDLE_MS = 10 * 60_000; // killed after 10 minutes without a command
export const COMMAND_MS = 60_000;
export const CAPS = { user: 30 * 60, visitor: 5 * 60, global: 300 * 60 }; // sandbox seconds per day

export const sandboxReady = () => Boolean(process.env.E2B_API_KEY);

// What the toolchain needs, and the apt packages that provide it.
const TOOLS: Record<string, string> = { "g++": "g++", gcc: "gcc", cmake: "cmake", make: "make", python3: "python3", pip3: "python3-pip", node: "nodejs", npm: "npm" };

// Text files that come back to the project after a run; build outputs and binaries stay in the sandbox.
const TEXT = /\.(c|cc|cpp|h|hpp|java|go|mod|sum|rs|toml|py|txt|md|js|mjs|ts|json|html|css|csv|ya?ml|sh|sql|ipynb)$/i;

const memory = new Map<string, { sandboxId: string; ready: boolean }>();

async function remembered(owner: string, project: string) {
  if (!process.env.DATABASE_URL) return memory.get(`${owner}:${project}`);
  const [row] = await sql()`select sandbox_id, ready from sandboxes where owner_id = ${owner} and project_id = ${project}`;
  return row as { sandboxId: string; ready: boolean } | undefined;
}

async function remember(owner: string, project: string, sandboxId: string, ready: boolean) {
  if (!process.env.DATABASE_URL) return void memory.set(`${owner}:${project}`, { sandboxId, ready });
  await sql()`
    insert into sandboxes ${sql()({ ownerId: owner, projectId: project, sandboxId, ready, updatedAt: Date.now() })}
    on conflict (owner_id, project_id) do update set sandbox_id = excluded.sandbox_id, ready = excluded.ready, updated_at = excluded.updated_at`;
}

// Reconnects to the project's sandbox, or creates one (files are re-synced on every run, so nothing is lost).
export async function openSandbox(owner: string, project: string, say: (line: string) => void): Promise<Sandbox> {
  const opts = { apiKey: process.env.E2B_API_KEY, timeoutMs: IDLE_MS };
  const known = await remembered(owner, project);
  let box: Sandbox | undefined;
  if (known) {
    try {
      box = await Sandbox.connect(known.sandboxId, opts);
      await box.setTimeout(IDLE_MS);
    } catch {
      box = undefined; // it timed out; make a fresh one
    }
  }
  if (!box) {
    say("Starting a cloud sandbox…");
    // no environment variables are passed in: no Relib secret ever reaches the sandbox
    box = await Sandbox.create(opts);
  }
  if (!known || known.sandboxId !== box.sandboxId || !known.ready) {
    const check = await box.commands.run(`for t in ${Object.keys(TOOLS).join(" ")}; do command -v $t >/dev/null || echo $t; done`);
    const missing = check.stdout.split("\n").filter(Boolean);
    if (missing.length) {
      say(`Installing ${missing.join(", ")} (first run only)…`);
      const pkgs = [...new Set(missing.map((t) => TOOLS[t]))].join(" ");
      await box.commands.run(`sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ${pkgs}`, { timeoutMs: 240_000 });
    }
    await box.commands.run(`mkdir -p ${ROOT}`);
    await remember(owner, project, box.sandboxId, true);
  }
  return box;
}

export type ProjectFile = { path: string; content: string };

export const safePath = (path: string) => !path.startsWith("/") && !path.split("/").includes("..") && path.length <= 300;

export async function syncIn(box: Sandbox, files: ProjectFile[]) {
  if (files.length) await box.files.write(files.map((f) => ({ path: `${ROOT}/${f.path}`, data: f.content })));
  await box.commands.run("touch /tmp/.relib-stamp");
}

// Text files the run created or changed, so they are copied back to the project.
export async function syncOut(box: Sandbox): Promise<ProjectFile[]> {
  const found = await box.commands.run(`cd ${ROOT} && find . -type f -newer /tmp/.relib-stamp -size -200k -not -path './node_modules/*' -not -path './.git/*' -not -path './target/*' | head -50`);
  const paths = found.stdout
    .split("\n")
    .map((p) => p.replace(/^\.\//, ""))
    .filter((p) => p && TEXT.test(p));
  return Promise.all(paths.map(async (path) => ({ path, content: await box.files.read(`${ROOT}/${path}`) })));
}
