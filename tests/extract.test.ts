import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import { relevantChunks } from "../src/lib/agent/materials";
import { extractChunks } from "../src/lib/extract";

const zip = async (files: Record<string, string>) => {
  const z = new JSZip();
  for (const [name, body] of Object.entries(files)) z.file(name, body);
  return z.generateAsync({ type: "uint8array" });
};

test("pptx keeps slide numbers in order", async () => {
  const bytes = await zip({
    "ppt/slides/slide10.xml": "<p:sld><a:t>Ten</a:t></p:sld>",
    "ppt/slides/slide2.xml": '<p:sld><a:t>Price &amp; demand</a:t><a:t lang="en">curve</a:t></p:sld>',
  });
  assert.deepEqual(await extractChunks("pptx", bytes), [
    { location: "Slide 1", text: "Price & demand curve" },
    { location: "Slide 2", text: "Ten" },
  ]);
});

test("docx splits on Word's page breaks", async () => {
  const bytes = await zip({
    "word/document.xml": '<w:body><w:p><w:r><w:t>First</w:t></w:r></w:p><w:p><w:r><w:lastRenderedPageBreak/><w:t xml:space="preserve">Second</w:t></w:r></w:p></w:body>',
  });
  assert.deepEqual(await extractChunks("docx", bytes), [
    { location: "Page 1", text: "First" },
    { location: "Page 2", text: "Second" },
  ]);
});

test("xlsx reads shared strings and numbers per sheet", async () => {
  const bytes = await zip({
    "xl/workbook.xml": '<workbook><sheets><sheet name="Sales" sheetId="1"/></sheets></workbook>',
    "xl/sharedStrings.xml": "<sst><si><t>Units</t></si></sst>",
    "xl/worksheets/sheet1.xml": '<sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1"><v>42</v></c></row></sheetData>',
  });
  assert.deepEqual(await extractChunks("xlsx", bytes), [{ location: "Sheet Sales", text: "Units 42" }]);
});

test("relevantChunks prefers the chunk about the question", () => {
  const chunks = [
    { location: "Slide 1", text: "Welcome to the course and the reading list" },
    { location: "Slide 2", text: "Elasticity measures how demand responds to price changes" },
  ];
  assert.equal(relevantChunks(chunks, "explain price elasticity")[0].location, "Slide 2");
});
