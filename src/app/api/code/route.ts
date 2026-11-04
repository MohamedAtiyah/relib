import { z } from "zod";
import { explainError, suggestFix } from "@/lib/agent/code";
import { route } from "@/lib/route";

const CodeInput = z.object({
  mode: z.enum(["explain", "fix"]),
  language: z.string().max(30),
  code: z.string().min(1).max(30000),
  output: z.string().max(20000),
});

export const maxDuration = 60;
export const POST = route(CodeInput, 20, async ({ mode, ...input }) =>
  mode === "explain" ? { explanation: await explainError(input) } : await suggestFix(input),
);
