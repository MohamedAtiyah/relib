import { z } from "zod";

export type Folder = { id: string; name: string; createdAt: number };

export type Page = {
  id: string;
  folderId: string;
  title: string;
  editorState: string; // Lexical JSON
  plainText: string;
  createdAt: number;
  updatedAt: number;
  analysedText?: string; // the notes the agent last ran on
};

export const SourceSchema = z.object({
  id: z.string().max(100),
  title: z.string().max(1000),
  authors: z.array(z.string().max(300)).max(200),
  year: z.number().optional(),
  abstract: z.string().max(20000),
  url: z.url({ protocol: /^https?$/ }).max(2000),
  doi: z.string().max(300).optional(),
  origin: z.enum(["openalex", "arxiv", "user"]),
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
export type FitGap = z.infer<typeof FitGapDraftSchema> & { basedOn: "abstract" };

export type Suggestion = {
  pageId: string;
  sourceId: string;
  folderId: string;
  fitGap: FitGap;
  status: "new" | "accepted" | "declined";
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
export const AnalyzeInput = z.object({ notes, source: SourceSchema });
export const ChatInput = z.object({
  notes: z.string().max(50000),
  sources: z.array(z.string().max(1000)).max(100),
  // no "system" role: a client must not be able to replace the tutor's rules
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(20),
});
export const NeurolibInput = z.object({
  pages: z.array(z.object({ title: z.string().max(500), text: z.string().max(50000) })).max(100),
  sources: z.array(z.object({ id: z.string().max(100), title: z.string().max(1000) })).max(300),
});
