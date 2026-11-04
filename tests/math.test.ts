import assert from "node:assert/strict";
import { test } from "node:test";
import { PALETTE, renderTex, SHORTCUTS } from "../src/lib/math";

test("every palette symbol and shortcut renders in KaTeX", () => {
  const broken = [...PALETTE.map((s) => [s.name, s.latex]), ...Object.entries(SHORTCUTS)].filter(([, latex]) => renderTex(latex, true).error);
  assert.deepEqual(broken, []);
  assert.ok(PALETTE.length > 200);
});

test("palette search finds integral and chemistry renders", () => {
  assert.ok(PALETTE.some((s) => s.name.includes("integral")));
  assert.equal(renderTex("\\ce{2H2 + O2 -> 2H2O}", true).error, undefined);
  assert.equal(renderTex("\\begin{cases} x & x > 0 \\\\ -x & x \\le 0 \\end{cases}", true).error, undefined);
});
