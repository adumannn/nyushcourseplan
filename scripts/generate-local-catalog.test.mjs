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
