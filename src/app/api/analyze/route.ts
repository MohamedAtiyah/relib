import { analyzeSource } from "@/lib/agent/analyze";
import { route } from "@/lib/route";
import { AnalyzeInput } from "@/lib/schemas";

export const maxDuration = 60;
export const POST = route(AnalyzeInput, 60, ({ notes, source }) => analyzeSource(notes, source));
