#!/usr/bin/env node

import path from "path";
import {
  buildImportSummary,
  ensureReportsDirectory,
  getDefaultValidationReportPath,
  normalizeSchoolDataset,
  parseArgs,
  readSchoolScrape,
  resolveSchoolSlug,
  writeJsonFile,
} from "./lib/catalog-normalize.mjs";

function resolveOutputPath(flags, schoolSlug) {
  if (!flags.out) {
    return getDefaultValidationReportPath(schoolSlug);
  }

  return path.isAbsolute(flags.out)
    ? flags.out
    : path.resolve(process.cwd(), flags.out);
}

function printUsage() {
  console.log(`
Usage:
  node scripts/validate-scraped-data.mjs
  node scripts/validate-scraped-data.mjs --school shanghai
  node scripts/validate-scraped-data.mjs --out scraped-data/reports/shanghai.validation.json
  node scripts/validate-scraped-data.mjs --no-write

Options:
  --school <slug>   School file to validate. Defaults to "shanghai".
  --out <path>      Output path for the JSON validation report.
  --no-write        Print the report summary without writing a file.
  --help            Show this help message.
`.trim());
}

function printSummary(report, outputPath, wroteFile) {
  const { school, counts, issueCounts, samples } = report;

  console.log(`Validated scraped catalog for ${school.slug} (${school.name})`);
  console.log(`Source file: ${school.sourceFile}`);
  console.log("");
  console.log("Counts:");
  console.log(`  Subjects: ${counts.subjects}`);
  console.log(`  Courses: ${counts.courses}`);
  console.log(`  Published-ready courses: ${counts.publishedCourses}`);
  console.log(`  Variable-credit courses: ${counts.variableCreditCourses}`);
  console.log(`  Placeholder courses: ${counts.placeholderCourses}`);
  console.log(`  Relationships: ${counts.relationships}`);
  console.log(`  Unresolved relationships: ${counts.unresolvedRelationships}`);
  console.log(`  Attributes: ${counts.attributes}`);
  console.log(`  Duplicate course IDs: ${counts.duplicateCourseIds}`);

  const issueEntries = Object.entries(issueCounts).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  if (issueEntries.length > 0) {
    console.log("");
    console.log("Issue counts:");
    for (const [issue, count] of issueEntries) {
      console.log(`  ${issue}: ${count}`);
    }
  } else {
    console.log("");
    console.log("Issue counts:");
    console.log("  none");
  }

  if (samples.duplicateCourseIds.length > 0) {
    console.log("");
    console.log("Sample duplicate course IDs:");
    for (const courseId of samples.duplicateCourseIds.slice(0, 10)) {
      console.log(`  - ${courseId}`);
    }
  }

  if (samples.unresolvedRelationshipIds.length > 0) {
    console.log("");
    console.log("Sample unresolved related course IDs:");
    for (const courseId of samples.unresolvedRelationshipIds.slice(0, 10)) {
      console.log(`  - ${courseId}`);
    }
  }

  if (samples.coursesWithIssues.length > 0) {
    console.log("");
    console.log("Sample courses with validation issues:");
    for (const course of samples.coursesWithIssues.slice(0, 10)) {
      console.log(
        `  - ${course.id || "(missing id)"} | ${course.code || "(missing code)"} | ${course.validationIssues.join(", ")}`,
      );
    }
  }

  console.log("");
  if (wroteFile) {
    console.log(`Validation report written to ${outputPath}`);
  } else {
    console.log("Validation report was not written (--no-write).");
  }
}

function main() {
  const flags = parseArgs();

  if (flags.help) {
    printUsage();
    return;
  }

  const schoolSlug = resolveSchoolSlug(flags);
  const outputPath = resolveOutputPath(flags, schoolSlug);
  const { filePath, data } = readSchoolScrape(schoolSlug);
  const normalized = normalizeSchoolDataset(schoolSlug, data, filePath);
  const report = {
    generatedAt: new Date().toISOString(),
    ...buildImportSummary(normalized),
    validation: normalized.validationSummary,
  };

  const shouldWrite = !flags["no-write"];

  if (shouldWrite) {
    ensureReportsDirectory();
    writeJsonFile(outputPath, report);
  }

  printSummary(report.validation, outputPath, shouldWrite);
}

try {
  main();
} catch (error) {
  console.error("Failed to validate scraped data.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
