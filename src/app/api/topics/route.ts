import { extractTopics } from "@/lib/agent/topics";
import { route } from "@/lib/route";
import { TopicsInput } from "@/lib/schemas";

export const maxDuration = 60;
export const POST = route(TopicsInput, 30, ({ notes }) => extractTopics(notes));
