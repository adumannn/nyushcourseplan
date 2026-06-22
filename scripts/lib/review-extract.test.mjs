import assert from "node:assert/strict";
import test from "node:test";
import {
  sha256Hex,
  isStub,
  cleanText,
  asString,
  asStringArray,
  buildCatalogSlices,
} from "./review-extract.mjs";

test("sha256Hex is stable and hex", () => {
  assert.equal(sha256Hex("abc"), sha256Hex("abc"));
  assert.match(sha256Hex("abc"), /^[0-9a-f]{64}$/);
  assert.notEqual(sha256Hex("abc"), sha256Hex("abd"));
});

test("isStub catches placeholders and empties", () => {
  for (const s of ["", "  ", "N/A", "none", "Unstated", "unknown", "not stated", undefined])
    assert.equal(isStub(s), true, `expected stub: ${s}`);
  assert.equal(isStub("Moderate"), false);
});

test("cleanText trims real values, blanks stubs", () => {
  assert.equal(cleanText("  Heavy  "), "Heavy");
  assert.equal(cleanText("N/A"), "");
});

test("asString / asStringArray coerce defensively", () => {
  assert.equal(asString(5), "");
  assert.equal(asString("x"), "x");
  assert.deepEqual(asStringArray(["a", " b ", "", 3]), ["a", "b"]);
  assert.deepEqual(asStringArray("nope"), []);
});

test("buildCatalogSlices distributes round-robin and drops empties", () => {
  const cat = Array.from({ length: 7 }, (_, i) => ({ id: `C${i}`, code: `c ${i}`, name: `n${i}` }));
  const slices = buildCatalogSlices(cat, 3);
  assert.equal(slices.length, 3);
  assert.deepEqual(slices.map((s) => s.length), [3, 2, 2]); // 0,3,6 | 1,4 | 2,5
  assert.equal(slices.flat().length, 7);
  // k larger than catalog → no empty slices returned
  assert.equal(buildCatalogSlices(cat.slice(0, 2), 5).length, 2);
});
