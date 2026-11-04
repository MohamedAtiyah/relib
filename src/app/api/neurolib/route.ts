import { buildTree } from "@/lib/agent/neurolib";
import { route } from "@/lib/route";
import { NeurolibInput } from "@/lib/schemas";
import { sql } from "@/lib/sql";

// The folder's uploaded materials join the map as one more "page": the key concepts found in each file.
async function materialPages(userId: string | null, folderId?: string) {
  if (!userId || !folderId || !process.env.DATABASE_URL) return [];
  const files = await sql()`select filename, concepts from files where owner_id = ${userId} and folder_id = ${folderId}`;
  return files.flatMap((f) =>
    Array.isArray(f.concepts) && f.concepts.length
      ? [{ title: `Material: ${f.filename}`, text: (f.concepts as { name: string; explanation: string }[]).map((c) => `${c.name}: ${c.explanation}`).join("\n") }]
      : [],
  );
}

export const maxDuration = 60;
export const POST = route(NeurolibInput, 10, async ({ folderId, ...input }, userId) => ({
  nodes: await buildTree({ ...input, pages: [...input.pages, ...(await materialPages(userId, folderId))] }),
}));
