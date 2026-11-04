import { $dfs } from "@lexical/utils";
import { $getNodeByKey, $getRoot, type LexicalEditor } from "lexical";
import { $createCitationNode, $isCitationNode } from "@/components/nodes";
import type { CiteRef } from "./cite";

// The page's sentences, numbered the same way the Where it fits agent sees them.
export const sentencesOf = (text: string) =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
    .slice(0, 120)
    .map((s) => s.slice(0, 600));

// Inserts a live citation after the sentence, before its full stop. False if the sentence is no longer there.
export function citeAfter(editor: LexicalEditor, sentence: string, ref: CiteRef): Promise<boolean> {
  const tail = sentence.replace(/[.!?]$/, "").slice(-24);
  return new Promise((resolve) =>
    editor.update(
      () => {
        for (const node of $getRoot().getAllTextNodes()) {
          const at = node.getTextContent().indexOf(tail);
          if (at < 0) continue;
          const end = at + tail.length;
          const [left] = end < node.getTextContentSize() ? node.splitText(end) : [node];
          left.insertAfter($createCitationNode([ref]));
          return resolve(true);
        }
        resolve(false);
      },
      { discrete: true },
    ),
  );
}

// Every citation in document order, for numbering notes and numeric styles.
export function citationsInOrder(editor: LexicalEditor): { key: string; refs: CiteRef[] }[] {
  return editor.getEditorState().read(() => $dfs().flatMap(({ node }) => ($isCitationNode(node) ? [{ key: node.getKey(), refs: node.__refs }] : [])));
}

export function setRefs(editor: LexicalEditor, key: string, refs: CiteRef[]) {
  editor.update(() => {
    const node = $getNodeByKey(key);
    if ($isCitationNode(node)) node.setRefs(refs);
  });
}

// Marks sentences with the CSS Custom Highlight API: nothing in the document changes.
export function highlight(root: HTMLElement | null, sentences: string[]) {
  const registry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
  if (!registry || !root) return;
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent ?? "";
    for (const s of sentences) {
      const part = s.replace(/[.!?]$/, "").slice(-60);
      const at = text.indexOf(part);
      if (at < 0) continue;
      // from the sentence's start when it is in this text node, else from the matched tail
      const head = text.indexOf(s.slice(0, 30));
      const range = new Range();
      range.setStart(n, head >= 0 && head <= at ? head : at);
      range.setEnd(n, at + part.length);
      ranges.push(range);
    }
  }
  if (ranges.length) registry.set("fit", new (window as unknown as { Highlight: new (...r: Range[]) => unknown }).Highlight(...ranges));
  else registry.delete("fit");
}
