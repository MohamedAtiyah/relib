import { tutorReply } from "@/lib/agent/tutor";
import { route } from "@/lib/route";
import { ChatInput } from "@/lib/schemas";

export const maxDuration = 60;
export const POST = route(ChatInput, 30, async (input) => ({ reply: await tutorReply(input) }));
