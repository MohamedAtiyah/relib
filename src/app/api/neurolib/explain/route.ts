import { z } from "zod";
import { explainEndPoint } from "@/lib/agent/neurolib";
import { folderExcerpts } from "@/lib/materials";
import { route } from "@/lib/route";

const Input = z.object({
  concept: z.string().min(1).max(200),
  neighbours: z.array(z.string().max(200)).max(12),
  notes: z.array(z.object({ title: z.string().max(500), text: z.string().max(20000) })).max(30),
  sources: z.array(z.string().max(1000)).max(50),
  folderId: z.string().max(200).optional(),
});

export const maxDuration = 60;
export const POST = route(Input, 20, async ({ folderId, ...input }, userId) => {
  const excerpts = await folderExcerpts(userId, folderId, `${input.concept} ${input.neighbours.join(" ")}`);
  return explainEndPoint({ ...input, excerpts });
});
