import {
  $createParagraphNode,
  $getNearestNodeFromDOMNode,
  DecoratorNode,
  ElementNode,
  ParagraphNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type SerializedLexicalNode,
  type SerializedParagraphNode,
} from "lexical";
import type { ReactNode } from "react";
import type { Source } from "@/lib/schemas";
import { PythonCell } from "./PythonCell";

export class CalloutNode extends ParagraphNode {
  static getType() {
    return "callout";
  }
  static clone(node: CalloutNode) {
    return new CalloutNode(node.__key);
  }
  static importJSON(json: SerializedParagraphNode) {
    return new CalloutNode().updateFromJSON(json);
  }
  createDOM(config: EditorConfig) {
    const dom = super.createDOM(config);
    dom.classList.add("rl-callout");
    return dom;
  }
}

export const $createCalloutNode = () => new CalloutNode();

type SerializedToggle = SerializedElementNode & { closed: boolean };

// First child is the title line; the rest hide when closed.
export class ToggleNode extends ElementNode {
  __closed: boolean;

  constructor(closed = false, key?: NodeKey) {
    super(key);
    this.__closed = closed;
  }
  static getType() {
    return "toggle";
  }
  static clone(node: ToggleNode) {
    return new ToggleNode(node.__closed, node.__key);
  }
  static importJSON(json: SerializedToggle) {
    return new ToggleNode(json.closed).updateFromJSON(json);
  }
  exportJSON(): SerializedToggle {
    return { ...super.exportJSON(), closed: this.__closed };
  }
  createDOM(_config: EditorConfig, editor: LexicalEditor) {
    const dom = document.createElement("div");
    dom.className = "rl-toggle";
    dom.dataset.closed = String(this.__closed);
    dom.addEventListener("click", (e) => {
      if (e.target !== dom || e.offsetX > 24) return; // only the caret gutter
      editor.update(() => {
        const node = $getNearestNodeFromDOMNode(dom);
        if ($isToggleNode(node)) node.toggle();
      });
    });
    return dom;
  }
  updateDOM(prev: ToggleNode, dom: HTMLElement) {
    if (prev.__closed !== this.__closed) dom.dataset.closed = String(this.__closed);
    return false;
  }
  isShadowRoot() {
    return true;
  }
  canBeEmpty() {
    return false;
  }
  isClosed() {
    return this.getLatest().__closed;
  }
  toggle() {
    const closing = !this.isClosed();
    this.getWritable().__closed = closing;
    // the caret must not stay inside the body once it is hidden
    if (closing) this.getFirstChildOrThrow().selectEnd();
  }
}

export const $isToggleNode = (node: LexicalNode | null | undefined): node is ToggleNode => node instanceof ToggleNode;

export function $createToggleNode() {
  return new ToggleNode().append($createParagraphNode(), $createParagraphNode());
}

type SourceData = Pick<Source, "title" | "authors" | "year" | "url">;
type SerializedSource = SerializedLexicalNode & { source: SourceData };

export class SourceNode extends DecoratorNode<ReactNode> {
  __source: SourceData;

  constructor(source: SourceData, key?: NodeKey) {
    super(key);
    this.__source = source;
  }
  static getType() {
    return "source";
  }
  static clone(node: SourceNode) {
    return new SourceNode(node.__source, node.__key);
  }
  static importJSON(json: SerializedSource) {
    return new SourceNode(json.source);
  }
  exportJSON(): SerializedSource {
    return { ...super.exportJSON(), source: this.__source };
  }
  createDOM() {
    return document.createElement("div");
  }
  updateDOM() {
    return false;
  }
  isInline() {
    return false;
  }
  getTextContent() {
    return `${this.__source.title} (${this.__source.year ?? "n.d."})`;
  }
  decorate() {
    const { title, authors, year, url } = this.__source;
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="my-2 block rounded-card border border-hairline bg-surface px-4 py-3 no-underline!"
      >
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="block text-xs text-muted">{[authors.slice(0, 3).join(", "), year].filter(Boolean).join(" · ")}</span>
      </a>
    );
  }
}

export const $createSourceNode = (source: SourceData) => new SourceNode(source);

type SerializedPython = SerializedLexicalNode & { code: string; output: string };

// A Python cell: the code and its last output are saved with the note.
export class PythonNode extends DecoratorNode<ReactNode> {
  __code: string;
  __output: string;

  constructor(code = "", output = "", key?: NodeKey) {
    super(key);
    this.__code = code;
    this.__output = output;
  }
  static getType() {
    return "python";
  }
  static clone(node: PythonNode) {
    return new PythonNode(node.__code, node.__output, node.__key);
  }
  static importJSON(json: SerializedPython) {
    return new PythonNode(json.code, json.output);
  }
  exportJSON(): SerializedPython {
    return { ...super.exportJSON(), code: this.__code, output: this.__output };
  }
  createDOM() {
    return document.createElement("div");
  }
  updateDOM() {
    return false;
  }
  isInline() {
    return false;
  }
  getTextContent() {
    return `${this.__code}\n${this.__output}`;
  }
  set(code: string, output: string) {
    const self = this.getWritable();
    self.__code = code;
    self.__output = output;
  }
  decorate() {
    return <PythonCell nodeKey={this.__key} code={this.__code} output={this.__output} />;
  }
}

export const $createPythonNode = () => new PythonNode();
