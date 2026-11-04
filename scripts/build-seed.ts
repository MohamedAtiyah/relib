import { writeFileSync } from "node:fs";
import { analyzeSource } from "@/lib/agent/analyze";
import { buildTree } from "@/lib/agent/neurolib";
import { rankSources } from "@/lib/agent/rank";
import { extractTopics } from "@/lib/agent/topics";
import { tutorReply } from "@/lib/agent/tutor";
import { modelMode, recorded } from "@/lib/model";
import { DEFAULT_PRESET } from "@/lib/db";
import type { Folder, Page, Preset, Source, Suggestion } from "@/lib/schemas";
import { searchSources } from "@/lib/sources";

// A fixed past: the browser shifts it so the newest suggestion lands "now" and the folders were last opened 3 days ago.
const NOW = Date.UTC(2026, 9, 20, 9);
const DAY = 86_400_000;
const LAST_OPENED = NOW - 3 * DAY;

type SeedPage = { id: string; title: string; blocks: string[]; accept: number; editedSinceVisit?: boolean };
type SeedFolder = Pick<Folder, "id" | "name" | "kind" | "agentRole"> & { pages: SeedPage[] };

// [heading, paragraph, ...] per page; the same text the Lexical editor reports as plainText
const FOLDERS: SeedFolder[] = [
  {
    id: "seed-economics",
    name: "Economics",
    kind: "study",
    agentRole: "Tutor",
    pages: [
      {
        id: "seed-supply",
        title: "Supply and demand",
        accept: 0,
        editedSinceVisit: true,
        blocks: [
          "Equilibrium",
          "A market clears where quantity supplied equals quantity demanded. A price ceiling below equilibrium causes a shortage; a price floor above it causes a surplus.",
          "Elasticity",
          "Price elasticity of demand measures how strongly buyers respond to a price change. Necessities tend to be inelastic. Disruptions in supply chains shift the supply curve left and raise prices.",
        ],
      },
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
    ],
  },
  {
    id: "seed-remote",
    name: "Remote work study",
    kind: "research",
    agentRole: "Research assistant",
    pages: [
      {
        id: "seed-remote-lit",
        title: "Literature notes",
        accept: 1,
        blocks: [
          "Productivity",
          "Studies of working from home report mixed effects on productivity. Call centre experiments found higher output, while software teams reported slower collaboration and fewer new ideas.",
          "Wellbeing",
          "Remote workers save commuting time but report more isolation. Hybrid schedules of two or three office days appear to balance focus work with team contact.",
        ],
      },
      {
        id: "seed-remote-method",
        title: "Method",
        accept: 0,
        blocks: [
          "Design",
          "A survey of employees at three firms, comparing self-reported focus time and meeting load across fully remote, hybrid and office-based teams.",
          "Analysis",
          "Regression of weekly output on days in the office, controlling for role, tenure and team size. Interviews with managers add context to the survey results.",
        ],
      },
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
const trees: Record<string, unknown> = {};
let order = 0;

for (const folder of FOLDERS) {
  const folderSources = new Map<string, Source>();
  for (const seed of folder.pages) {
    const plainText = seed.blocks.join("\n\n");
    const notes = `${seed.title}\n${plainText}`;
    const { field, topics } = await extractTopics(notes);
    const found = await searchSources(topics.map((t) => `${t.label} ${field}`));
    const fresh = rankSources(found.filter((s) => !allSources.has(s.id)), notes, { accepted: [], declined: [] }).slice(0, 4);
    console.log(seed.title, topics.map((t) => t.label), `${fresh.length} sources`);
    const analysed = await Promise.all(fresh.map((source) => analyzeSource(notes, source)));
    fresh.forEach((source, i) => {
      allSources.set(source.id, source);
      folderSources.set(source.id, source);
      const accepted = i < seed.accept;
      suggestions.push({
        pageId: seed.id,
        sourceId: source.id,
        folderId: folder.id,
        fitGap: analysed[i],
        status: accepted ? "accepted" : "new",
        // accepted ones are from before the last visit; the rest arrived since
        createdAt: accepted ? LAST_OPENED - DAY : NOW - order++ * 60_000,
      });
    });
    pages.push({
      id: seed.id,
      folderId: folder.id,
      title: seed.title,
      editorState: editorState(seed.blocks),
      plainText,
      createdAt: NOW - 20 * DAY + order++,
      updatedAt: seed.editedSinceVisit ? NOW - DAY : LAST_OPENED - DAY,
      analysedText: notes,
    });
  }
  const folderPages = pages.filter((p) => p.folderId === folder.id);
  trees[folder.id] = await buildTree({
    pages: folderPages.map((p) => ({ title: p.title, text: p.plainText })),
    sources: [...folderSources.values()].map(({ id, title }) => ({ id, title })),
  });
}

for (const question of ["Explain price elasticity of demand", "Write my notes on supply and demand for me"]) {
  console.log(question, "->", await tutorReply({ notes: "", sources: [], messages: [{ role: "user", content: question }] }));
}

const folders: Folder[] = FOLDERS.map(({ id, name, kind, agentRole }, i) => ({ id, name, kind, agentRole, createdAt: NOW - 30 * DAY + i, lastOpenedAt: LAST_OPENED }));
const presets: Preset[] = [{ ...DEFAULT_PRESET, fields: DEFAULT_PRESET.fields.map((f) => (f.label === "Course" ? { ...f, value: "ECON 101" } : f)) }];

const generatedBy = modelMode() === "meta" ? "muse-spark" : "stand-in";
writeFileSync(
  "seed/economics.json",
  `${JSON.stringify({ generatedBy, folders, pages, presets, sources: [...allSources.values()], suggestions, trees }, null, 2)}\n`,
);
writeFileSync("seed/demo-cache.json", `${JSON.stringify(Object.fromEntries(recorded), null, 2)}\n`);
console.log(`Wrote seed from ${generatedBy}: ${allSources.size} sources, ${folders.length} folders`);
