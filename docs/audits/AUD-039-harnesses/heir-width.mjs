/** Check actual generated heir-sheet text operators against page width, with synthetic host text. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { HeirInstructions } from "../../../dist/export/heir-sheet-text.js";
import { renderHeirSheet, A5, A6 } from "../../../dist/export/heir-sheet.js";
import { nodeCardRenderer } from "../../../dist/export/platform-node.js";

const font = fontkit.create(readFileSync(new URL("../../../assets/fonts/DejaVuSans-UI.ttf", import.meta.url)));
const advance = font.glyphForCodePoint("W".codePointAt(0)).advanceWidth / font.unitsPerEm;
let clipped = 0;
for (const [size, format] of [["a5", A5], ["a6", A6]]) {
  const route = { subtitle: "W".repeat(100), address: "", start: [], decode: () => [], restore: () => [], dateDigitHelp: undefined };
  const facts = { backup: { kind: "encoded", format: "english", words: 12 }, mode: "direct", dates: 0 };
  const text = new HeirInstructions(route).text(facts);
  let bytes;
  try {
    bytes = await renderHeirSheet(nodeCardRenderer, text, format);
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    assert.equal(document.getPageCount(), 2);
    const page = document.getPage(0);
    const contents = page.node.Contents();
    const references = contents && "asArray" in contents ? contents.asArray() : [contents];
    const operators = references.map((reference) => {
      const stream = document.context.lookup(reference);
      assert.ok(stream instanceof PDFRawStream);
      return Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
    }).join("\n");
    const line = /<((?:[0-9A-Fa-f]{4}){100})>\s*Tj/u.exec(operators);
    if (line === null) {
      console.log(JSON.stringify({ size, unbrokenHundredGlyphLine: false }));
      continue;
    }
    assert.equal(new Set(line[1].match(/.{4}/gu)).size, 1);
    const context = operators.slice(operators.lastIndexOf("BT", line.index), line.index);
    const pointSize = Number(/\s([\d.]+)\s+Tf/u.exec(context)?.[1]);
    const x = Number(/1 0 0 1 ([\d.]+) [\d.]+ Tm/u.exec(context)?.[1]);
    assert.ok(Number.isFinite(pointSize) && Number.isFinite(x));
    const width = advance * 100 * pointSize;
    const rightEdge = x + width;
    const overPage = rightEdge > page.getWidth();
    clipped += Number(overPage);
    console.log(JSON.stringify({ size, pointSize, x, textWidth: width, rightEdge, pageWidth: page.getWidth(), overPage }));
  } catch (error) {
    // An explicit layout refusal is an acceptable fix; unrelated failures still fail this probe.
    if (typeof error?.code !== "string" || !error.code.startsWith("export.heir-sheet.")) throw error;
    console.log(JSON.stringify({ size, refusedWith: error.code }));
  } finally {
    bytes?.fill(0);
  }
}
console.log(JSON.stringify({ clippedDocuments: clipped }));
process.exitCode = clipped === 0 ? 0 : 1;
