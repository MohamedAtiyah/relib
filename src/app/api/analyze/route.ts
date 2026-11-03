import { analyzeSource } from "@/lib/agent/analyze";
import { route } from "@/lib/route";
import { AnalyzeInput } from "@/lib/schemas";
import { sql } from "@/lib/sql";

export const maxDuration = 60;
export const POST = route(AnalyzeInput, 60, async ({ notes, source, useFullText }, userId) => {
  // the text never travels through the browser, and only its owner's id can reach it
  const [row] = useFullText && userId ? await sql()`select full_text from sources where owner_id = ${userId} and id = ${source.id}` : [];
  return analyzeSource(notes, source, row?.fullText ?? undefined);
});
