import { analyzeSource } from "@/lib/agent/analyze";
import { rankSources } from "@/lib/agent/rank";
import { extractTopics } from "@/lib/agent/topics";
import { modelMode } from "@/lib/model";
import { searchSources } from "@/lib/sources";

const notes = `Supply and demand
A market reaches equilibrium where quantity supplied equals quantity demanded. A price ceiling below equilibrium causes a shortage.
Price elasticity of demand measures how strongly buyers respond to a price change. Shifts in supply chains move the supply curve.`;

console.log("mode:", modelMode());
const { field, topics } = await extractTopics(notes);
console.log(field, topics);
const found = await searchSources(topics.map((t) => `${t.label} ${field}`));
for (const source of rankSources(found, notes, { accepted: [], declined: [] }).slice(0, 3)) {
  console.log(`\n${source.title}\n`, await analyzeSource(notes, source));
}
