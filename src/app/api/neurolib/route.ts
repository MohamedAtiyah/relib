import { buildTree } from "@/lib/agent/neurolib";
import { route } from "@/lib/route";
import { NeurolibInput } from "@/lib/schemas";

export const maxDuration = 60;
export const POST = route(NeurolibInput, 10, async (input) => ({ nodes: await buildTree(input) }));
