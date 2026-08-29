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

test("course search ignores punctuation and matches unordered metadata", () => {
  const course = {
    id: "CSCI-SHU-210",
    code: "CSCI-SHU 210",
    name: "Data Structures",
    department: "Computer Science",
    equivalentCodes: { NewYork: "CSCI-UA-102" },
  };

  assert.equal(getCourseSearchRank(course, "csci shu 210"), 0);
  assert.equal(getCourseSearchRank(course, "CSCI-UA 102"), 0);
  assert.equal(getCourseSearchRank(course, "structures data"), 3);
  assert.equal(getCourseSearchRank(course, "computer structures"), 3);
});
