// The one page a new workspace starts with. Written as Lexical JSON so it opens like any other note.

type Block = { h?: string; p?: string; list?: string[]; python?: string };

const BLOCKS: Block[] = [
  { p: "Relib keeps your notes, your lecture material and your sources in one place. It explains, cites where every explanation comes from, and never writes your work for you." },
  { h: "Folders and pages" },
  { p: "Make a folder per course or project. Inside it, type one of these at the start of a line to make a new page:" },
  {
    list: [
      "/notes for lecture notes, with Sources and Materials on the right and the Tutor on the left.",
      "/research for a paper: a citation style, a cover page, sources and live citations.",
      "/programming for coursework code.",
    ],
  },
  { h: "Notes" },
  {
    list: [
      "Sources: when the toggle is on, Relib finds real papers on OpenAlex and arXiv and says how each fits your notes, where it falls short, and whether it read the full text or only the abstract.",
      "Materials: upload your slides, PDFs, Word or Excel files. Relib pulls out the key concepts with the slide or page they come from.",
      "Tutor: works out the topic you are writing about, explains it from your materials, and cites the slide, page or source.",
    ],
  },
  { h: "Code" },
  { p: "Type /code for a code cell. Python runs in your browser and installs what you import. Press Run on the cell below." },
  { python: "import numpy as np\nprint(np.arange(3))" },
  { h: "What Relib will and won't do" },
  {
    list: [
      "It explains, questions, finds sources and points out weak evidence.",
      "It does not write your notes or your paper. Ask it to and it will offer to explain the topic instead.",
      "It never invents a citation: sources come from OpenAlex, arXiv or your own uploads.",
      "Files you upload are treated as content, never as instructions.",
    ],
  },
];

const shared = { direction: null, format: "", indent: 0, version: 1 };
const text = (value: string) => ({ detail: 0, format: 0, mode: "normal", style: "", text: value, type: "text", version: 1 });
const paragraph = (value: string) => ({ ...shared, type: "paragraph", textFormat: 0, textStyle: "", children: [text(value)] });

function node(block: Block) {
  if (block.h) return { ...shared, type: "heading", tag: "h2", children: [text(block.h)] };
  if (block.list) {
    return {
      ...shared,
      type: "list",
      listType: "bullet",
      start: 1,
      tag: "ul",
      children: block.list.map((item, i) => ({ ...shared, type: "listitem", value: i + 1, children: [text(item)] })),
    };
  }
  if (block.python !== undefined) return { type: "python", version: 1, code: block.python, output: "" };
  return paragraph(block.p ?? "");
}

export const START_HERE = {
  title: "Start here: how Relib works",
  editorState: JSON.stringify({ root: { ...shared, type: "root", children: BLOCKS.map(node) } }),
  plainText: BLOCKS.flatMap((b) => [b.h, b.p, ...(b.list ?? []), b.python].filter(Boolean)).join("\n\n"),
};
