import { z } from "zod";
import type { Program } from "./notebook";

export type Folder = {
  id: string;
  name: string;
  lastOpenedAt?: number;
  createdAt: number;
  updatedAt?: number;
};

export const PAGE_TYPES = ["notes", "research", "programming"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export type Page = {
  id: string;
  folderId: string;
  type: PageType;
  title: string;
  editorState: string; // Lexical JSON
  plainText: string;
  createdAt: number;
  updatedAt: number;
  analysedText?: string; // the notes the agent last ran on
  lastOpenedAt?: number;
  sourcesOn?: boolean; // off by default: each suggestion run spends model calls
  research?: Research;
  program?: Program; // a /programming page's notebook cells or project files
};

export type CoverField = { label: string; value: string };

// A research page's citation style and cover page. presetId marks a cover still exactly as the preset filled it.
export type Research = { style: string; cover: CoverField[]; presetId?: string };

export const SourceSchema = z.object({
  id: z.string().max(100),
  title: z.string().max(1000),
  authors: z.array(z.string().max(300)).max(200),
  year: z.number().optional(),
  abstract: z.string().max(20000),
  url: z.url({ protocol: /^https?$/ }).max(2000),
  doi: z.string().max(300).optional(),
  origin: z.enum(["openalex", "arxiv", "user"]),
  venue: z.string().max(500).optional(),
  volume: z.string().max(50).optional(),
  issue: z.string().max(50).optional(),
  pages: z.string().max(50).optional(),
  entered: z.array(z.string().max(20)).max(10).optional(), // fields the student typed rather than fetched
});
export type Source = z.infer<typeof SourceSchema>;

export const TopicSchema = z.object({
  label: z.string(),
  parent: z.string().optional(),
});
export type Topic = z.infer<typeof TopicSchema>;

export const TopicsSchema = z.object({
  field: z.string(), // the discipline, so "demand" searches economics and not biology
  topics: z.array(TopicSchema),
});
export type Topics = z.infer<typeof TopicsSchema>;

export const FitGapDraftSchema = z.object({
  summary: z.string(),
  whyItHelps: z.array(z.string()),
  weakPoints: z.array(z.string()),
  keyPoints: z.array(z.string()),
  relevance: z.number(),
});
export const FitGapSchema = FitGapDraftSchema.extend({ basedOn: z.enum(["abstract", "full_text"]) });
export type FitGap = z.infer<typeof FitGapSchema>;

export type Suggestion = {
  pageId: string;
  sourceId: string;
  folderId: string;
  fitGap: FitGap;
  status: "new" | "accepted" | "declined";
  addedBy?: "you"; // a DOI or link the student added, listed apart from suggestions
  createdAt?: number;
  updatedAt?: number;
};

export type Preset = {
  id: string;
  folderId?: string;
  name: string;
  fields: { label: string; value: string }[]; // the title block
  citationStyle: string;
  sections: string[]; // required headings, in order
  updatedAt?: number;
};

export const TreeSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      parentId: z.string().optional(),
      sourceIds: z.array(z.string()),
    }),
  ),
});
export type TreeNode = z.infer<typeof TreeSchema>["nodes"][number];
export type TopicNode = TreeNode & { weight: number };

const notes = z.string().min(1).max(50000);

export const TopicsInput = z.object({ notes });
export const SourcesInput = z.object({ topics: z.array(z.string().min(1).max(200)).min(1).max(8) });
export const AnalyzeInput = z.object({ notes, source: SourceSchema, useFullText: z.boolean().optional() });
export const ChatInput = z.object({
  notes: z.string().max(50000),
  sources: z.array(z.string().max(1000)).max(100),
  role: z.string().max(200).optional(),
  folderId: z.string().max(200).optional(),
  // no "system" role: a client must not be able to replace the tutor's rules
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(20),
});
export const TopicInput = z.object({
  notes: z.string().min(1).max(50000),
  sources: z.array(z.string().max(1000)).max(100),
  folderId: z.string().max(200).optional(),
});
export const NeurolibInput = z.object({
  pages: z.array(z.object({ title: z.string().max(500), text: z.string().max(50000) })).max(100),
  sources: z.array(z.object({ id: z.string().max(100), title: z.string().max(1000) })).max(300),
  folderId: z.string().max(200).optional(),
});
