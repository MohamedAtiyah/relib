import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { clerkEnabled } from "@/lib/clerk";
import { allow } from "@/lib/route";
import { CAPS, COMMAND_MS, openSandbox, ROOT, safePath, sandboxReady, syncIn, syncOut } from "@/lib/sandbox";
import { bump } from "@/lib/usage";

export const maxDuration = 300;

const Exec = z.object({
  project: z.string().min(1).max(200),
  command: z.string().min(1).max(2000),
  files: z.array(z.object({ path: z.string().min(1).max(300).refine(safePath), content: z.string().max(500_000) })).max(200),
});

// Runs one command in the project's sandbox and streams its output as server-sent events.
export async function POST(req: Request) {
  const userId = clerkEnabled ? (await auth()).userId : null;
  const owner = userId ?? `visitor:${req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local"}`;
  if (!allow(`sandbox:${owner}`, 20)) return Response.json({ error: "rate_limited" }, { status: 429 });
  if (!sandboxReady()) return Response.json({ error: "sandbox_off" }, { status: 503 });
  const parsed = Exec.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  if ((await bump(`sandbox:${owner}`, undefined, 0)) > (userId ? CAPS.user : CAPS.visitor)) return Response.json({ error: "sandbox_cap" }, { status: 429 });
  if ((await bump("sandbox:global", undefined, 0)) > CAPS.global) return Response.json({ error: "global_cap" }, { status: 429 });

  const { project, command, files } = parsed.data;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      const started = Date.now();
      try {
        const box = await openSandbox(owner, project, (text) => send({ type: "info", text }));
        await syncIn(box, files);
        const handle = await box.commands.run(command, {
          background: true,
          cwd: ROOT,
          timeoutMs: COMMAND_MS,
          onStdout: (text) => send({ type: "stdout", text }),
          onStderr: (text) => send({ type: "stderr", text }),
        });
        req.signal.addEventListener("abort", () => handle.kill().catch(() => {}));
        let code = 0;
        try {
          code = (await handle.wait()).exitCode;
        } catch (err) {
          const e = err as { exitCode?: number; name?: string };
          code = e.exitCode ?? -1;
          if (e.exitCode === undefined) send({ type: "info", text: req.signal.aborted ? "Stopped." : `Stopped after ${COMMAND_MS / 1000} seconds.` });
        }
        send({ type: "exit", code, files: await syncOut(box) });
      } catch (err) {
        console.error("sandbox", err);
        send({ type: "error", text: "The cloud sandbox is unavailable right now. Try again in a minute." });
      } finally {
        await bump(`sandbox:${owner}`, undefined, Math.ceil((Date.now() - started) / 1000)).catch(() => 0);
        await bump("sandbox:global", undefined, Math.ceil((Date.now() - started) / 1000)).catch(() => 0);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
}
