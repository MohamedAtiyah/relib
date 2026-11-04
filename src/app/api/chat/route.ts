import { tutorReply } from "@/lib/agent/tutor";
import { folderExcerpts } from "@/lib/materials";
import { route } from "@/lib/route";
import { ChatInput } from "@/lib/schemas";

export const maxDuration = 60;
export const POST = route(ChatInput, 30, async (input, userId) => {
  const excerpts = await folderExcerpts(userId, input.folderId, `${input.messages.at(-1)!.content} ${input.notes.slice(0, 2000)}`);
  return { reply: await tutorReply({ ...input, excerpts }) };
});
