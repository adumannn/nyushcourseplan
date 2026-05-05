import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalogFromScrape } from "./generate-local-catalog.mjs";

test("aggregates duplicate course IDs into multi-campus metadata", () => {
  const catalog = buildCatalogFromScrape({
    "arts-science": {
      courses: {
        "csci-ua": {
          name: "Computer Science (CSCI-UA)",
          courses: [
            {
              id: "CSCI-UA-101",
              code: "CSCI-UA 101",
              name: "Intro in New York",
              credits: 4,
            },
          ],
        },
      },
    },
    shanghai: {
      courses: {
        "csci-shu": {
          name: "Computer Science (CSCI-SHU)",
          courses: [
            {
              id: "CSCI-UA-101",
              code: "CSCI-UA 101",
              name: "Intro in Shanghai",
              credits: 4,
            },
          ],
        },
      },
    },
  });

  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].name, "Intro in Shanghai");
  assert.deepEqual(catalog[0].campuses, ["New York", "Shanghai"]);
});

test("merges cross-campus equivalents with different IDs by name+credits+family", () => {
  const scrape = {
    shanghai: {
      courses: {
        "csci-shu": {
          name: "Computer Science (CSCI-SHU)",
          courses: [
            {
              id: "CSCI-SHU-210",
              code: "CSCI-SHU 210",
              name: "Data Structures",
              credits: 4,
            },
          ],
        },
      },
    },
    "arts-science": {
      courses: {
        "csci-ua": {
          name: "Computer Science (CSCI-UA)",
          courses: [
            {
              id: "CSCI-UA-102",
              code: "CSCI-UA 102",
              name: "Data Structures",
              credits: 4,
            },
          ],
        },
      },
    },
    "abu-dhabi": {
      courses: {
        "cs-uh": {
          name: "Computer Science (CS-UH)",
          courses: [
            {
              id: "CS-UH-1050",
              code: "CS-UH 1050",
              name: "Data Structures",
              credits: 4,
            },
          ],
        },
      },
    },
  };

  const catalog = buildCatalogFromScrape(scrape);
  assert.equal(catalog.length, 1, "should collapse 3 campus variants into 1");

  const entry = catalog[0];
  assert.equal(entry.id, "CSCI-SHU-210", "Shanghai should be canonical");
  assert.deepEqual(
    entry.campuses,
    ["Shanghai", "New York", "Abu Dhabi"],
    "campuses should include all three in canonical order",
  );
  assert.deepEqual(entry.equivalentCodes, {
    "New York": "CSCI-UA 102",
    "Abu Dhabi": "CS-UH 1050",
  });
});

test("does not merge same-named courses with different credits", () => {
  const catalog = buildCatalogFromScrape({
    shanghai: {
      courses: {
        "writ-shu": {
          name: "Writing (WRIT-SHU)",
          courses: [
            { id: "WRIT-SHU-101", code: "WRIT-SHU 101", name: "Writing", credits: 4 },
          ],
        },
      },
    },
    "arts-science": {
      courses: {
        "writ-ua": {
          name: "Writing (WRIT-UA)",
          courses: [
            { id: "WRIT-UA-101", code: "WRIT-UA 101", name: "Writing", credits: 2 },
          ],
        },
      },
    },
  });

  assert.equal(catalog.length, 2);
});

test("NOT_EQUIVALENT keeps listed pair separate even when heuristic matches", () => {
  const scrape = {
    shanghai: {
      courses: {
        "writ-shu": {
          name: "Writing (WRIT-SHU)",
          courses: [
            { id: "WRIT-SHU-101", code: "WRIT-SHU 101", name: "Writing", credits: 4 },
          ],
        },
      },
    },
    "arts-science": {
      courses: {
        "writ-ua": {
          name: "Writing (WRIT-UA)",
          courses: [
            { id: "WRIT-UA-101", code: "WRIT-UA 101", name: "Writing", credits: 4 },
          ],
        },
      },
    },
  };

  const merged = buildCatalogFromScrape(scrape);
  assert.equal(merged.length, 1, "by default the heuristic merges them");

  const split = buildCatalogFromScrape(scrape, {
    NOT_EQUIVALENT: [["WRIT-SHU-101", "WRIT-UA-101"]],
  });
  assert.equal(split.length, 2, "NOT_EQUIVALENT keeps them separate");
});

test("FORCE_EQUIVALENT merges courses the heuristic would not match", () => {
  const scrape = {
    shanghai: {
      courses: {
        "csci-shu": {
          name: "Computer Science (CSCI-SHU)",
          courses: [
            {
              id: "CSCI-SHU-301",
              code: "CSCI-SHU 301",
              name: "Algorithms",
              credits: 4,
            },
          ],
        },
      },
    },
    "arts-science": {
      courses: {
        "csci-ua": {
          name: "Computer Science (CSCI-UA)",
          courses: [
            {
              id: "CSCI-UA-310",
              code: "CSCI-UA 310",
              name: "Basic Algorithms",
              credits: 4,
            },
          ],
        },
      },
    },
  };

  const baseline = buildCatalogFromScrape(scrape);
  assert.equal(baseline.length, 2, "differing names → no auto-merge");

  const forced = buildCatalogFromScrape(scrape, {
    FORCE_EQUIVALENT: [["CSCI-SHU-301", "CSCI-UA-310"]],
  });
  assert.equal(forced.length, 1, "FORCE_EQUIVALENT collapses them");
  assert.deepEqual(forced[0].campuses, ["Shanghai", "New York"]);
  assert.equal(forced[0].equivalentCodes["New York"], "CSCI-UA 310");
});
