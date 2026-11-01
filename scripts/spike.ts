import { z } from "zod";
import { chat, chatJson, modelMode } from "@/lib/model";

if (modelMode() !== "meta") {
  console.error(`Spike needs META_API_KEY in .env.local and DEMO_MODE off (mode: ${modelMode()})`);
  process.exit(1);
}
console.log(await chat({ tag: "spike", messages: [{ role: "user", content: "Reply with one short sentence." }] }));
console.log(
  await chatJson(
    { tag: "spike_json", messages: [{ role: "user", content: "Name one economics concept." }] },
    z.object({ concept: z.string() }),
  ),
);
