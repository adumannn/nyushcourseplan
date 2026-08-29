import assert from "node:assert/strict";
import test from "node:test";
import { getCourseSearchRank } from "./courseSearch.js";

const poh = {
  id: "WRIT-SHU-201",
  code: "WRIT-SHU 201",
  name: "Perspectives on the Humanities",
};
const gps = {
  id: "CCSF-SHU-101L",
  code: "CCSF-SHU 101L",
  name: "Global Perspectives on Society",
};

test("course search recognizes core acronyms and ranks exact titles first", () => {
  assert.equal(getCourseSearchRank(poh, "poh"), 0);
  assert.equal(getCourseSearchRank(gps, "gps"), 0);
  assert.equal(getCourseSearchRank(gps, "Global Perspectives on Society"), 0);
  assert.equal(getCourseSearchRank(poh, "perspectives"), 1);
});
