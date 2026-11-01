import type { TreeNode } from "./schemas";

// Bubble size: pages that mention the topic, accepted sources, how much was written, and its subtopics.
export function nodeWeight(
  node: TreeNode,
  nodes: TreeNode[],
  pages: { plainText: string }[],
  accepted: Set<string>,
): number {
  const label = node.label.toLowerCase();
  const mentioning = pages.filter((p) => p.plainText.toLowerCase().includes(label));
  const text = mentioning.reduce((sum, p) => sum + p.plainText.length, 0);
  const own = 1 + 2 * mentioning.length + 3 * node.sourceIds.filter((id) => accepted.has(id)).length + Math.log10(1 + text);
  const children = nodes.filter((n) => n.parentId === node.id);
  return own + children.reduce((sum, c) => sum + 0.6 * nodeWeight(c, nodes, pages, accepted), 0);
}
