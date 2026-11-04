import { z } from "zod";
import { whereItFits } from "@/lib/agent/fits";
import { route } from "@/lib/route";
import { SourceSchema } from "@/lib/schemas";

const FitsInput = z.object({ sentences: z.array(z.string().min(1).max(600)).min(1).max(120), source: SourceSchema });

export const maxDuration = 60;
export const POST = route(FitsInput, 20, async ({ sentences, source }) => ({ fits: await whereItFits(sentences, source) }));
