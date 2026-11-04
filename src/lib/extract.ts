import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";

export type Chunk = { location: string; text: string };

export const MATERIAL_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
} as const;
export type MaterialKind = (typeof MATERIAL_TYPES)[keyof typeof MATERIAL_TYPES];

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

const tagText = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}(?: [^>]*)?>([^<]*)</${tag}>`, "g"))].map((m) => decode(m[1]));
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const numbered = (zip: JSZip, pattern: RegExp) =>
  Object.keys(zip.files)
    .filter((name) => pattern.test(name))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));

// Text with the slide, page or sheet it came from, so explanations can cite it.
export async function extractChunks(kind: MaterialKind, bytes: Uint8Array): Promise<Chunk[]> {
  if (kind === "pdf") {
    const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: false });
    return text.map((t, i) => ({ location: `Page ${i + 1}`, text: clean(t) })).filter((c) => c.text);
  }
  const zip = await JSZip.loadAsync(bytes);
  const read = (name: string) => zip.file(name)?.async("string") ?? Promise.resolve("");
  if (kind === "pptx") {
    const slides = numbered(zip, /^ppt\/slides\/slide\d+\.xml$/);
    return (await Promise.all(slides.map(read)))
      .map((xml, i) => ({ location: `Slide ${i + 1}`, text: clean(tagText(xml, "a:t").join(" ")) }))
      .filter((c) => c.text);
  }
  if (kind === "docx") {
    // Word records where it last broke pages; that is the closest a server gets to page numbers
    const body = await read("word/document.xml");
    return body
      .split(/<w:lastRenderedPageBreak\/>|<w:br w:type="page"\/>/)
      .map((part, i) => ({ location: `Page ${i + 1}`, text: clean(part.split(/<\/w:p>/).map((p) => tagText(p, "w:t").join("")).join(" ")) }))
      .filter((c) => c.text);
  }
  const shared = tagText(await read("xl/sharedStrings.xml"), "t");
  const names = [...(await read("xl/workbook.xml")).matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) => decode(m[1]));
  const sheets = numbered(zip, /^xl\/worksheets\/sheet\d+\.xml$/);
  return (await Promise.all(sheets.map(read)))
    .map((xml, i) => {
      const cells = [...xml.matchAll(/<c ([^>]*)>(?:<f>[^<]*<\/f>)?<v>([^<]*)<\/v><\/c>|<c ([^>]*)><is><t[^>]*>([^<]*)<\/t><\/is><\/c>/g)].map((m) =>
        m[2] !== undefined ? (/t="s"/.test(m[1]) ? shared[Number(m[2])] ?? "" : decode(m[2])) : decode(m[4]),
      );
      return { location: `Sheet ${names[i] ?? i + 1}`, text: clean(cells.join(" ")) };
    })
    .filter((c) => c.text);
}
