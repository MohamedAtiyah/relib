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
  if (code === "ai_off") return "Live AI is switched off on this site.";
  if (code === "daily_cap") return "You've used today's AI calls. Sign in for more, or come back tomorrow.";
  if (code === "global_cap") return "Relib's AI budget for today is used up. Try again tomorrow.";
  if (code === "rate_limited") return "Too many requests. Wait a minute and try again.";
  return "Something went wrong reaching the model or the paper search. Try again shortly.";
};

let status: Promise<ModelMode> | undefined;

export const getMode = () =>
  (status ??= fetch("/api/status")
    .then((r) => r.json())
    .then((d) => d.mode));

