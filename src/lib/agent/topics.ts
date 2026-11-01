import { chatJson } from "../model";
import { TopicsSchema } from "../schemas";

const SYSTEM =
  'From the notes below, list the distinct concepts the learner is studying as a short list of at most 5 topics, each with an optional parent topic. Set "field" to the academic discipline in 1 to 3 words. Return only JSON matching the schema. Do not invent topics not present in the notes.';

export const extractTopics = (notes: string) =>
  chatJson(
    {
      tag: "topics",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `NOTES:\n${notes.slice(0, 6000)}` },
      ],
    },
    TopicsSchema,
  );
