import { tutorTopic } from "@/lib/agent/tutor";
import { folderExcerpts } from "@/lib/materials";
import { route } from "@/lib/route";
import { TopicInput } from "@/lib/schemas";

export const maxDuration = 60;
export const POST = route(TopicInput, 10, async (input, userId) => {
  const excerpts = await folderExcerpts(userId, input.folderId, input.notes.slice(-3000));
  return tutorTopic({ ...input, excerpts });
});
