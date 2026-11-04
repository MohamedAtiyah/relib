import { db } from "./db";
import type { ModelMode } from "./model";

export class ApiError extends Error {}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: "bad_response" }));
  if (!res.ok) throw new ApiError(data.error);
  return data;
}

export const errorText = (err: unknown) => {
  const code = err instanceof Error ? err.message : "";
  if (code === "demo_miss") return "The demo only has saved results. Sign in for live ones.";
  if (code === "rate_limited") return "Too many requests. Wait a minute and try again.";
  return "Something went wrong reaching the model or the paper search. Try again shortly.";
};

let status: Promise<ModelMode> | undefined;

export const getMode = () =>
  (status ??= fetch("/api/status")
    .then((r) => r.json())
    .then((d) => d.mode));

// The server removes the file, its source and its suggestions; this mirrors that here, since deletes do not sync.
export async function deleteFile(id: string) {
  const res = await fetch(`/api/files/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new ApiError("upstream_failed");
  await db.transaction("rw", db.sources, db.suggestions, async () => {
    await db.suggestions.filter((s) => s.sourceId === id).delete();
    await db.sources.delete(id);
  });
}
