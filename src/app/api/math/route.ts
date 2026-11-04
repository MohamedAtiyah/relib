import { z } from "zod";
import { englishToLatex, explainSteps } from "@/lib/agent/math";
import { route } from "@/lib/route";

const MathInput = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("english"), text: z.string().min(2).max(500) }),
  z.object({ mode: z.literal("explain"), latex: z.string().max(2000), operation: z.string().max(60), result: z.string().max(4000) }),
]);

export const maxDuration = 60;
export const POST = route(MathInput, 30, async (input) =>
  input.mode === "english" ? englishToLatex(input.text) : { explanation: await explainSteps(input) },
);
