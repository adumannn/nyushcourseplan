#!/usr/bin/env node

/**
 * Sync credit values in src/data/courses.js from scraped-data/shanghai.json.
 *
 * Motivation:
 *   The hand-authored local seed catalog hardcodes `credits: 4` for every
 *   course that carries an `id` field. Real NYU Shanghai courses are a mix
 *   of 2- and 4-credit offerings, so the planner's per-semester totals and
 *   18-credit cap warning are wrong for any 2-credit course in the plan.
 *
 *   This script reads the already-scraped bulletin data, builds a map of
 *   course-id → credits, and rewrites the matching `credits:` integer
 *   literals in src/data/courses.js. Objects without an `id` line (e.g. the
 *   CCSF/WRIT/IPC curriculum slots and the 8-credit ENGL-SHU 100/101
 *   yearlong block) are never visited by the scanner, so they are preserved
 *   automatically.
 *
 * Usage:
 *   node scripts/sync-local-credits.mjs            # apply changes
 *   node scripts/sync-local-credits.mjs --dry-run  # preview diff, no write
 *   node scripts/sync-local-credits.mjs --help
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const SCRAPED_JSON = path.join(REPO_ROOT, "scraped-data", "shanghai.json");
const COURSES_JS = path.join(REPO_ROOT, "src", "data", "courses.js");

const ID_LINE_RE = /^(\s*)id:\s*['"]([A-Z]+-SHU-[A-Z0-9]+)['"],?\s*$/;
const CREDITS_LINE_RE = /^(\s*)credits:\s*(\d+)(,?\s*)$/;
const BLOCK_END_RE = /^\s*\},?\s*$/;
const VARIABLE_CREDIT_RE = /^(\d+)\s*-\s*\d+$/;

// How many lines after an `id:` line to keep scanning for the sibling
// `credits:` line before giving up. Covers the widest object in the seed
// catalog with room to spare.
const CREDITS_LOOKAHEAD = 8;

function parseArgs(argv) {
  const flags = { dryRun: false, help: false };
  for (const arg of argv) {
    if (arg === "--dry-run" || arg === "-n") flags.dryRun = true;
    else if (arg === "--help" || arg === "-h") flags.help = true;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return flags;
}

function printUsage() {
  console.log(`
Usage:
  node scripts/sync-local-credits.mjs
  node scripts/sync-local-credits.mjs --dry-run

Options:
  --dry-run, -n   Print the diff and summary without writing courses.js.
  --help, -h      Show this help message.
`.trim());
}

/**
 * Flatten scraped-data/shanghai.json into a Map<id, credits>.
 *
 *   - Integer credits pass through unchanged.
 *   - Range strings like "2-4" resolve to the minimum (2). Per the project
 *     owner, NYU Shanghai courses are effectively fixed at 2 or 4; variable
 *     ranges appear rarely and the lower bound is the safer default for
 *     staying under the 18-credit cap.
 *   - Any other shape is skipped.
 *   - On duplicate ids with differing credits (cross-listed courses), the
 *     first seen value wins and a warning is logged.
 */
function buildCreditsMap(scraped) {
  const map = new Map();
  const conflicts = [];

  const subjects = scraped?.courses ?? {};
  for (const [subjectSlug, subject] of Object.entries(subjects)) {
    const courses = subject?.courses ?? [];
    for (const course of courses) {
      if (!course || typeof course.id !== "string") continue;

      let credits = null;
      if (typeof course.credits === "number" && Number.isFinite(course.credits)) {
        credits = course.credits;
      } else if (typeof course.credits === "string") {
        const rangeMatch = course.credits.match(VARIABLE_CREDIT_RE);
        if (rangeMatch) credits = parseInt(rangeMatch[1], 10);
      }
      if (credits === null) continue;

      if (map.has(course.id)) {
        const existing = map.get(course.id);
        if (existing !== credits) {
          conflicts.push({ id: course.id, kept: existing, ignored: credits, subject: subjectSlug });
        }
        continue;
      }

      map.set(course.id, credits);
    }
  }

  return { map, conflicts };
}

/**
 * Walk through the source text of courses.js line-by-line.
 *
 * When an `id: 'XXX-SHU-NNN'` line appears, look ahead up to
 * CREDITS_LOOKAHEAD lines for a sibling `credits: N,` line (stopping at the
 * block's closing `}` so we never leak into the next object). If found and
 * the scraped map has a value for that id, rewrite the integer.
 */
function patchCoursesSource(source, creditsMap) {
  const lines = source.split("\n");
  const stats = {
    patched: 0,
    unchanged: 0,
    missingFromScrape: 0,
    noCreditsSibling: 0,
    patchedIds: [],
    missingIds: [],
  };

  for (let i = 0; i < lines.length; i++) {
    const idMatch = lines[i].match(ID_LINE_RE);
    if (!idMatch) continue;

    const courseId = idMatch[2];
    const scrapedCredits = creditsMap.get(courseId);

    let creditsLineIdx = -1;
    const lookaheadEnd = Math.min(i + 1 + CREDITS_LOOKAHEAD, lines.length);
    for (let j = i + 1; j < lookaheadEnd; j++) {
      if (BLOCK_END_RE.test(lines[j])) break;
      if (CREDITS_LINE_RE.test(lines[j])) {
        creditsLineIdx = j;
        break;
      }
    }

    if (creditsLineIdx === -1) {
      stats.noCreditsSibling++;
      continue;
    }

    if (scrapedCredits === undefined) {
      stats.missingFromScrape++;
      stats.missingIds.push(courseId);
      continue;
    }

    const creditsMatch = lines[creditsLineIdx].match(CREDITS_LINE_RE);
    const existing = parseInt(creditsMatch[2], 10);
    if (existing === scrapedCredits) {
      stats.unchanged++;
      continue;
    }

    const [, indent, , trailing] = creditsMatch;
    lines[creditsLineIdx] = `${indent}credits: ${scrapedCredits}${trailing}`;
    stats.patched++;
    stats.patchedIds.push({ id: courseId, from: existing, to: scrapedCredits });
  }

  return { output: lines.join("\n"), stats };
}

/**
 * Minimal line-level diff printer. Not a full Myers diff — just scans for
 * the first differing line in each run and prints old/new pairs with
 * surrounding context. Good enough to eyeball a credit-only patch.
 */
function printDiff(oldText, newText) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const max = Math.max(oldLines.length, newLines.length);
  let diffCount = 0;
  for (let i = 0; i < max; i++) {
    if (oldLines[i] !== newLines[i]) {
      diffCount++;
      console.log(`  @ line ${i + 1}`);
      if (oldLines[i] !== undefined) console.log(`  - ${oldLines[i]}`);
      if (newLines[i] !== undefined) console.log(`  + ${newLines[i]}`);
    }
  }
  if (diffCount === 0) {
    console.log("  (no changes)");
  }
  return diffCount;
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printUsage();
    return;
  }

  const scrapedRaw = readFileSync(SCRAPED_JSON, "utf8");
  const scraped = JSON.parse(scrapedRaw);
  const { map: creditsMap, conflicts } = buildCreditsMap(scraped);

  const sourceText = readFileSync(COURSES_JS, "utf8");
  const { output, stats } = patchCoursesSource(sourceText, creditsMap);

  const changed = output !== sourceText;

  console.log(`Scraped credits indexed: ${creditsMap.size}`);
  if (conflicts.length > 0) {
    console.log(
      `Cross-listed credit conflicts (kept first): ${conflicts.length}`,
    );
    for (const c of conflicts.slice(0, 5)) {
      console.log(
        `  - ${c.id}: kept ${c.kept}, ignored ${c.ignored} (from ${c.subject})`,
      );
    }
    if (conflicts.length > 5) {
      console.log(`  ...and ${conflicts.length - 5} more`);
    }
  }
  console.log("");
  console.log("Patch summary:");
  console.log(`  Patched:              ${stats.patched}`);
  console.log(`  Already correct:      ${stats.unchanged}`);
  console.log(`  Missing from scrape:  ${stats.missingFromScrape}`);
  console.log(`  No sibling credits:   ${stats.noCreditsSibling}`);

  if (stats.patched > 0) {
    console.log("");
    console.log("Changed courses:");
    for (const p of stats.patchedIds) {
      console.log(`  - ${p.id}: ${p.from} → ${p.to}`);
    }
  }

  if (stats.missingIds.length > 0) {
    console.log("");
    console.log("IDs not present in scraped data (left untouched):");
    for (const id of stats.missingIds.slice(0, 20)) {
      console.log(`  - ${id}`);
    }
    if (stats.missingIds.length > 20) {
      console.log(`  ...and ${stats.missingIds.length - 20} more`);
    }
  }

  if (flags.dryRun) {
    console.log("");
    console.log("Diff (dry run — no file written):");
    printDiff(sourceText, output);
    return;
  }

  if (!changed) {
    console.log("");
    console.log(`No changes needed; ${COURSES_JS} is up to date.`);
    return;
  }

  writeFileSync(COURSES_JS, output, "utf8");
  console.log("");
  console.log(`Wrote ${COURSES_JS}`);
}

try {
  main();
} catch (error) {
  console.error("Failed to sync local credits.");
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
}
