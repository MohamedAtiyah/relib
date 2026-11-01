import { writeFileSync } from "node:fs";
import { analyzeSource } from "@/lib/agent/analyze";
import { buildTree } from "@/lib/agent/neurolib";
import { rankSources } from "@/lib/agent/rank";
import { extractTopics } from "@/lib/agent/topics";
import { tutorReply } from "@/lib/agent/tutor";
import { modelMode, recorded } from "@/lib/model";
import type { Page, Source, Suggestion } from "@/lib/schemas";
import { searchSources } from "@/lib/sources";

const FOLDER = { id: "seed-economics", name: "Economics", createdAt: 0 };

// [heading, paragraph, ...] per page; the same text the Lexical editor reports as plainText
const PAGES: { id: string; title: string; blocks: string[]; accept: number }[] = [
  {
    id: "seed-micro",
    title: "Microeconomics",
    accept: 0,
    blocks: [
      "Consumer choice",
      "Households choose bundles of goods that maximise utility subject to a budget constraint. Marginal utility falls as consumption rises, which is why demand curves slope down.",
      "Firms and market structure",
      "Under perfect competition firms are price takers. A monopoly restricts output and raises price above marginal cost, which creates a deadweight loss. Oligopoly sits in between and depends on strategic interaction.",
    ],
  },
  {
    id: "seed-macro",
    title: "Macroeconomics",
    accept: 1,
    blocks: [
      "Output and inflation",
      "Gross domestic product measures total output. Aggregate demand and aggregate supply explain short-run swings in output and the price level. The Phillips curve links unemployment and inflation.",
      "Policy",
      "Central banks use interest rates to manage inflation. Fiscal policy changes government spending and taxation, and the multiplier measures how much output responds.",
    ],
  },
  {
    id: "seed-supply",
    title: "Supply and demand",
    accept: 0,
    blocks: [
      "Equilibrium",
      "A market clears where quantity supplied equals quantity demanded. A price ceiling below equilibrium causes a shortage; a price floor above it causes a surplus.",
      "Elasticity",
      "Price elasticity of demand measures how strongly buyers respond to a price change. Necessities tend to be inelastic. Disruptions in supply chains shift the supply curve left and raise prices.",
    ],
  },
  {
    id: "seed-pestel",
    title: "PESTEL",
    accept: 1,
    blocks: [
      "The framework",
      "PESTEL analysis scans the external business environment across political, economic, social, technological, environmental and legal factors. Firms use it in strategic planning before entering a market.",
      "Using it well",
      "A useful analysis ranks factors by impact and likelihood instead of listing them. It pairs well with SWOT analysis, which adds internal strengths and weaknesses.",
    ],
  },
];

const text = (value: string) => ({ detail: 0, format: 0, mode: "normal", style: "", text: value, type: "text", version: 1 });
const shared = { direction: null, format: "", indent: 0, version: 1 };

function editorState(blocks: string[]) {
  const children = blocks.map((value, i) =>
    i % 2 === 0
      ? { ...shared, type: "heading", tag: "h2", children: [text(value)] }
      : { ...shared, type: "paragraph", textFormat: 0, textStyle: "", children: [text(value)] },
  );
  return JSON.stringify({ root: { ...shared, type: "root", children } });
}

const allSources = new Map<string, Source>();
const suggestions: Suggestion[] = [];
const pages: Page[] = [];

for (const [createdAt, seed] of PAGES.entries()) {
  const plainText = seed.blocks.join("\n\n");
  const notes = `${seed.title}\n${plainText}`;
  const { field, topics } = await extractTopics(notes);
  const found = await searchSources(topics.map((t) => `${t.label} ${field}`));
  const fresh = rankSources(found.filter((s) => !allSources.has(s.id)), notes, { accepted: [], declined: [] }).slice(0, 4);
  console.log(seed.title, topics.map((t) => t.label), `${fresh.length} sources`);
  const analysed = await Promise.all(fresh.map((source) => analyzeSource(notes, source)));
  fresh.forEach((source, i) => {
    allSources.set(source.id, source);
    suggestions.push({
      pageId: seed.id,
      sourceId: source.id,
      folderId: FOLDER.id,
      fitGap: analysed[i],
      status: i < seed.accept ? "accepted" : "new",
    });
  });
  pages.push({
    id: seed.id,
    folderId: FOLDER.id,
    title: seed.title,
    editorState: editorState(seed.blocks),
    plainText,
    createdAt,
    updatedAt: 0,
    analysedText: notes,
  });
}

const tree = await buildTree({
  pages: pages.map((p) => ({ title: p.title, text: p.plainText })),
  sources: [...allSources.values()].map(({ id, title }) => ({ id, title })),
});

for (const question of ["Explain price elasticity of demand", "Write my notes on supply and demand for me"]) {
  console.log(question, "->", await tutorReply({ notes: "", sources: [], messages: [{ role: "user", content: question }] }));
}

const generatedBy = modelMode() === "meta" ? "muse-spark" : "stand-in";
writeFileSync(
  "seed/economics.json",
  `${JSON.stringify({ generatedBy, folder: FOLDER, pages, sources: [...allSources.values()], suggestions, tree }, null, 2)}\n`,
);
writeFileSync("seed/demo-cache.json", `${JSON.stringify(Object.fromEntries(recorded), null, 2)}\n`);
console.log(`Wrote seed from ${generatedBy}: ${allSources.size} sources, ${tree.length} topics`);
