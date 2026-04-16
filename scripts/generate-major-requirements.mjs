#!/usr/bin/env node

/**
 * Generate MAJOR_REQUIREMENTS from scraped bulletin program data.
 *
 * Usage:
 *   node scripts/generate-major-requirements.mjs                 # Generate JSON
 *   node scripts/generate-major-requirements.mjs --update-source # Also update courses.js
 *   node scripts/generate-major-requirements.mjs --school shanghai
 *   node scripts/generate-major-requirements.mjs --json-out scraped-data/reports/major-requirements.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  normalizeAllMajors,
  generateMajorRequirementsSource,
} from "./lib/requirement-normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SCRAPED_DATA_DIR = path.join(PROJECT_ROOT, "scraped-data");
const COURSES_JS_PATH = path.join(PROJECT_ROOT, "src", "data", "courses.js");

function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i++;
    }
  }
  return flags;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function updateCoursesJs(source, newRequirementsBlock) {
  // Find the MAJOR_REQUIREMENTS object and replace it
  const startMarker = "export const MAJOR_REQUIREMENTS = {";
  const startIndex = source.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error(
      `Could not find "${startMarker}" in courses.js`,
    );
  }

  // Find the matching closing brace using depth counting
  let depth = 0;
  let endIndex = -1;
  const searchStart = startIndex + startMarker.length - 1; // position of opening {

  for (let i = searchStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        endIndex = i + 1; // include the closing }
        // Include trailing semicolon
        if (source[endIndex] === ";") endIndex++;
        break;
      }
    }
  }

  if (endIndex === -1) {
    throw new Error("Could not find closing brace for MAJOR_REQUIREMENTS");
  }

  return source.slice(0, startIndex) + newRequirementsBlock + source.slice(endIndex);
}

function printSummary(results) {
  console.log("Major requirement generation summary:");
  console.log("─".repeat(60));

  for (const [majorId, req] of Object.entries(results)) {
    const reqCount = req.requiredCourses.length;
    const selCount = req.selectOneCourses.length;
    const selTotal = req.selectOneCourses.reduce(
      (s, g) => s + (g.count || 1),
      0,
    );
    const capstone = req.capstone ? "yes" : "no";
    const electives = req.electivesNeeded;
    const conc = req.concentrations?.length || 0;

    console.log(
      `  ${majorId.padEnd(35)} ${reqCount} req, ${selTotal} sel (${selCount} grp), ${electives} elec, cap=${capstone}${conc > 0 ? `, ${conc} conc` : ""} → ${req.creditsNeeded} cr / ${req.coursesNeeded} courses`,
    );
  }
}

function main() {
  const flags = parseArgs();

  if (flags.help) {
    console.log(`
Usage:
  node scripts/generate-major-requirements.mjs
  node scripts/generate-major-requirements.mjs --update-source
  node scripts/generate-major-requirements.mjs --school shanghai
  node scripts/generate-major-requirements.mjs --json-out <path>

Options:
  --school <slug>       School to process. Defaults to "shanghai".
  --update-source       Update src/data/courses.js with generated requirements.
  --json-out <path>     Write the normalized requirements as JSON.
  --help                Show this help message.
`.trim());
    return;
  }

  const schoolSlug = flags.school || "shanghai";
  const scrapedPath = path.join(SCRAPED_DATA_DIR, `${schoolSlug}.json`);

  console.log(`Reading scraped data from ${scrapedPath}...`);
  const shanghaiData = readJson(scrapedPath);

  console.log("Normalizing major requirements...");
  const { results, warnings } = normalizeAllMajors(shanghaiData);

  if (warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const w of warnings) console.log(`  ⚠ ${w}`);
  }

  console.log("");
  printSummary(results);

  // Write JSON output
  const jsonOutPath =
    typeof flags["json-out"] === "string"
      ? flags["json-out"]
      : path.join(SCRAPED_DATA_DIR, "reports", "major-requirements.json");

  writeJson(jsonOutPath, {
    generatedAt: new Date().toISOString(),
    school: schoolSlug,
    majorCount: Object.keys(results).length,
    warnings,
    requirements: results,
  });
  console.log("");
  console.log(`Wrote JSON → ${jsonOutPath}`);

  // Update courses.js if requested
  if (flags["update-source"]) {
    console.log("");
    console.log(`Updating ${COURSES_JS_PATH}...`);

    const currentSource = fs.readFileSync(COURSES_JS_PATH, "utf8");
    const newBlock = generateMajorRequirementsSource(results);
    const updatedSource = updateCoursesJs(currentSource, newBlock);

    fs.writeFileSync(COURSES_JS_PATH, updatedSource);
    console.log("courses.js updated successfully.");
  }
}

main();
