import { createHash } from "node:crypto";
import { z } from "zod";
import { standIn } from "./standin";

export type Role = "system" | "user" | "assistant";
export type Msg = { role: Role; content: string };

type ChatOpts = {
  messages: Msg[];
  schema?: { name: string; schema: object }; // Meta documents json_schema output, not a plain JSON mode
  temperature?: number; // Meta advises leaving this unset for Muse Spark
  tag?: string; // labels token logs and stand-in routing
  model?: "spark" | "code";
};

// Live AI is switched off on this deployment (DEMO_MODE=true).
export class AiOff extends Error {}

export type ModelMode = "off" | "standin" | "meta";

export function liveMode(): ModelMode {
  if (process.env.DEMO_MODE === "true") return "off";
  return process.env.META_API_KEY ? "meta" : "standin";
}

export const modelMode = liveMode;

// Identical inputs cost one call per server instance.
// shortcut: in-memory and unbounded per instance; move to the Neon cache table if memory grows
const results = new Map<string, Promise<string>>();

export function chat(opts: ChatOpts): Promise<string> {
  const mode = modelMode();
  if (mode === "off") return Promise.reject(new AiOff());
  if (mode === "standin") return Promise.resolve(standIn(opts.messages, opts.schema?.name));
  const key = createHash("sha256").update(JSON.stringify([opts.model, opts.schema?.name, opts.messages])).digest("hex");
  const hit = results.get(key);
  if (hit) return hit;
  const run = callMeta(opts);
  if (results.size > 1000) results.clear();
  results.set(key, run);
  run.catch(() => results.delete(key)); // a failure must not stick
  return run;
}

async function callMeta(opts: ChatOpts): Promise<string> {
  const base = process.env.META_API_BASE_URL || "https://api.meta.ai/v1";
  const body = {
    // the code agent uses META_MODEL_CODE when the deployment sets one, otherwise Muse Spark
    model: (opts.model === "code" && process.env.META_MODEL_CODE) || process.env.META_MODEL_SPARK || "muse-spark-1.3",
    messages: opts.messages,
    reasoning_effort: "low", // Muse Spark always reasons; "none" is a 400
    temperature: opts.temperature,
    response_format: opts.schema && { type: "json_schema", json_schema: opts.schema },
  };
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.META_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      if (attempt < 2 && err instanceof DOMException && err.name === "TimeoutError") continue;
      throw err;
    }
    if (res.ok) {
      const data = await res.json();
      if (process.env.NODE_ENV !== "production") console.log("[model]", opts.tag, data.usage);
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Meta API returned no content");
      return content;
    }
    if (attempt < 2 && (res.status === 429 || res.status >= 500)) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 500 * 2 ** attempt + Math.random() * 250;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`Meta API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

export async function chatJson<T>(
  opts: Omit<ChatOpts, "schema"> & { tag: string },
  schema: z.ZodType<T>,
): Promise<T> {
  const jsonSchema = z.toJSONSchema(schema);
  delete jsonSchema.$schema;
  let messages = opts.messages;
  for (let attempt = 0; ; attempt++) {
    const raw = await chat({ ...opts, messages, schema: { name: opts.tag, schema: jsonSchema } });
    try {
      return schema.parse(JSON.parse(raw));
    } catch (err) {
      if (attempt === 1) throw err;
      messages = [
        ...messages,
        { role: "assistant", content: raw },
        { role: "user", content: `That was not valid: ${err}. Return only corrected JSON.` },
      ];
    }
  }
}
