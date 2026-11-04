import { relevantChunks } from "./agent/materials";
import type { Excerpt } from "./agent/tutor";
import { sql } from "./sql";

// The folder's material excerpts that best match the question. Owner-filtered, so a folder id alone reaches nothing.
export async function folderExcerpts(userId: string | null, folderId: string | undefined, query: string): Promise<Excerpt[]> {
  if (!userId || !folderId || !process.env.DATABASE_URL) return [];
  const rows = (await sql()`
    select f.filename, c.location, c.text from chunks c
    join files f on f.owner_id = c.owner_id and f.id = c.file_id
    where c.owner_id = ${userId} and f.folder_id = ${folderId}
    limit 2000`) as unknown as Excerpt[];
  return relevantChunks(rows, query);
}
