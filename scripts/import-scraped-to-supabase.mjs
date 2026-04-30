#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildImportSummary,
  loadProjectEnv,
  normalizeSchoolDataset,
  parseArgs,
  readSchoolScrape,
  resolveSchoolSlug,
  writeJsonFile,
} from "./lib/catalog-normalize.mjs";
import { getCampusLabelForSchoolSlug } from "../src/lib/campus.js";

const DEFAULT_BATCH_SIZE = 500;
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const ALL_COURSES_PATH = join(PROJECT_ROOT, "scraped-data", "all-courses.json");

function printUsage() {
  console.log(
    `
Usage:
  node scripts/import-scraped-to-supabase.mjs
  node scripts/import-scraped-to-supabase.mjs --school shanghai
  node scripts/import-scraped-to-supabase.mjs --all
  node scripts/import-scraped-to-supabase.mjs --publish
  node scripts/import-scraped-to-supabase.mjs --dry-run
  node scripts/import-scraped-to-supabase.mjs --batch-size 250

Options:
  --school <slug>       School file to import. Defaults to "shanghai".
  --all                 Import every school present in scraped-data/all-courses.json.
  --publish             Mark the imported school, subjects, and courses as published.
  --dry-run             Normalize and validate the dataset without writing to Supabase.
  --batch-size <n>      Maximum row count per insert batch. Defaults to 500.
  --report-out <path>   Optional path to write the import summary JSON.
  --help                Show this help message.

Required environment variables:
  VITE_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`.trim(),
  );
}

function resolveBatchSize(flags) {
  const raw = flags["batch-size"];
  if (!raw) return DEFAULT_BATCH_SIZE;

  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --batch-size value: ${raw}`);
  }

  return parsed;
}

function resolveReportPath(flags) {
  return typeof flags["report-out"] === "string" && flags["report-out"].trim()
    ? flags["report-out"].trim()
    : null;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createAdminClient() {
  loadProjectEnv();

  const supabaseUrl = requireEnv("VITE_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function campusPriority(schoolSlug) {
  const campus = getCampusLabelForSchoolSlug(schoolSlug);
  if (campus === "Shanghai") return 0;
  if (campus === "Abu Dhabi") return 1;
  if (campus === "New York") return 2;
  return 3;
}

function schoolSubjectKey(schoolSlug, subjectSlug) {
  return `${schoolSlug}::${subjectSlug}`;
}

function withPublishFlag(rows, shouldPublish) {
  return rows.map((row) => ({
    ...row,
    is_published: Boolean(shouldPublish && row.is_published),
  }));
}

function mapSubjectsForInsert(subjectRows, shouldPublish) {
  return subjectRows.map((row) => ({
    school_slug: row.school_slug,
    slug: row.slug,
    code: row.code,
    name: row.name,
    is_published: Boolean(shouldPublish),
  }));
}

function mapCoursesForInsert(courseRows, subjectIdBySlug, shouldPublish) {
  const rows = withPublishFlag(courseRows, shouldPublish);
  return rows.map((row) => {
    const subjectId = subjectIdBySlug.get(
      schoolSubjectKey(row.source_school_slug, row.subject_slug),
    );
    if (!subjectId) {
      throw new Error(
        `Unable to resolve subject id for "${row.source_school_slug}/${row.subject_slug}" while importing course "${row.id}".`,
      );
    }

    return {
      id: row.id,
      subject_id: subjectId,
      code: row.code,
      name: row.name,
      description: row.description,
      credits_min: row.credits_min,
      credits_max: row.credits_max,
      is_variable_credit: row.is_variable_credit,
      prerequisite_note: row.prerequisite_note,
      fulfillment_text: row.fulfillment_text,
      offering_text: row.offering_text,
      offering_terms: row.offering_terms,
      validation_issues: row.validation_issues,
      is_published: row.is_published,
    };
  });
}

function mapOfferingsForInsert(courseRows, subjectRows, shouldPublish) {
  const subjectsByKey = new Map(
    subjectRows.map((row) => [
      schoolSubjectKey(row.school_slug, row.slug),
      row,
    ]),
  );

  return courseRows.map((row) => {
    const subject = subjectsByKey.get(
      schoolSubjectKey(row.source_school_slug, row.subject_slug),
    );

    return {
      course_id: row.id,
      school_slug: row.source_school_slug,
      subject_slug: row.subject_slug,
      subject_code: subject?.code || "",
      subject_name: subject?.name || "",
      campus_label: getCampusLabelForSchoolSlug(row.source_school_slug),
      is_published: Boolean(shouldPublish && row.is_published),
    };
  });
}

function mapRelationshipsForInsert(relationshipRows) {
  return relationshipRows.map((row) => ({
    course_id: row.course_id,
    related_course_id: row.related_course_id,
    relationship_type: row.relationship_type,
    raw_note: row.raw_note,
    is_resolved: row.is_resolved,
  }));
}

function mapAttributesForInsert(attributeRows) {
  return attributeRows.map((row) => ({
    course_id: row.course_id,
    attribute_text: row.attribute_text,
  }));
}

function uniqueBy(rows, getKey) {
  const seen = new Set();
  const out = [];

  for (const row of rows) {
    const key = getKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

function dedupeCourseRows(courseRows) {
  const byId = new Map();

  for (const row of courseRows) {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, row);
      continue;
    }

    if (
      campusPriority(row.source_school_slug) <
      campusPriority(existing.source_school_slug)
    ) {
      byId.set(row.id, row);
    }
  }

  return Array.from(byId.values());
}

async function insertInBatches({ supabase, table, rows, batchSize }) {
  if (!rows.length) return;

  const chunks = chunkArray(rows, batchSize);
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      throw new Error(
        `Failed inserting batch ${index + 1}/${chunks.length} into ${table}: ${error.message}`,
      );
    }
  }
}

async function upsertInBatches({
  supabase,
  table,
  rows,
  batchSize,
  onConflict,
}) {
  if (!rows.length) return;

  const chunks = chunkArray(rows, batchSize);
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict });
    if (error) {
      throw new Error(
        `Failed upserting batch ${index + 1}/${chunks.length} into ${table}: ${error.message}`,
      );
    }
  }
}

async function fetchExistingCourseIds(supabase, courseIds, batchSize) {
  const existingIds = new Set();
  const uniqueIds = Array.from(new Set(courseIds.filter(Boolean)));

  for (const chunk of chunkArray(uniqueIds, batchSize)) {
    const { data, error } = await supabase
      .from("catalog_courses")
      .select("id")
      .in("id", chunk);

    if (error) {
      throw new Error(`Failed to check existing catalog courses: ${error.message}`);
    }

    for (const row of data || []) {
      existingIds.add(row.id);
    }
  }

  return existingIds;
}

async function insertMissingCourses({
  supabase,
  rows,
  batchSize,
}) {
  const existingIds = await fetchExistingCourseIds(
    supabase,
    rows.map((row) => row.id),
    batchSize,
  );
  const missingRows = rows.filter((row) => !existingIds.has(row.id));

  await insertInBatches({
    supabase,
    table: "catalog_courses",
    rows: missingRows,
    batchSize,
  });
}

async function startImportRun(supabase, schoolSlug, sourceFile) {
  const { data, error } = await supabase
    .from("catalog_import_runs")
    .insert({
      source_slug: schoolSlug,
      source_file: sourceFile,
      status: "started",
      summary: {},
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create catalog import run: ${error.message}`);
  }

  return data.id;
}

async function finishImportRun(supabase, importRunId, status, summary) {
  const payload = {
    status,
    summary,
    completed_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("catalog_import_runs")
    .update(payload)
    .eq("id", importRunId);

  if (error) {
    throw new Error(`Failed to update catalog import run: ${error.message}`);
  }
}

async function upsertSchool(supabase, schoolRow, shouldPublish) {
  const payload = {
    slug: schoolRow.slug,
    name: schoolRow.name,
    source_file: schoolRow.source_file,
    is_published: Boolean(shouldPublish),
  };

  const { error } = await supabase
    .from("catalog_schools")
    .upsert(payload, { onConflict: "slug" });

  if (error) {
    throw new Error(`Failed to upsert catalog school: ${error.message}`);
  }
}

async function replaceSchoolCatalog({
  supabase,
  schoolSlug,
  subjectRows,
  courseRows,
  relationshipRows,
  attributeRows,
  shouldPublish,
  batchSize,
}) {
  const { error: deleteOfferingsError } = await supabase
    .from("catalog_course_offerings")
    .delete()
    .eq("school_slug", schoolSlug);

  if (deleteOfferingsError && deleteOfferingsError.code !== "42P01") {
    throw new Error(
      `Failed to delete existing course offerings for "${schoolSlug}": ${deleteOfferingsError.message}`,
    );
  }

  const { error: deleteSubjectsError } = await supabase
    .from("catalog_subjects")
    .delete()
    .eq("school_slug", schoolSlug);

  if (deleteSubjectsError) {
    throw new Error(
      `Failed to delete existing subjects for "${schoolSlug}": ${deleteSubjectsError.message}`,
    );
  }

  const subjectsToInsert = mapSubjectsForInsert(subjectRows, shouldPublish);

  if (subjectsToInsert.length > 0) {
    const { data: insertedSubjects, error: subjectInsertError } = await supabase
      .from("catalog_subjects")
      .insert(subjectsToInsert)
      .select("id, slug");

    if (subjectInsertError) {
      throw new Error(
        `Failed to insert subjects for "${schoolSlug}": ${subjectInsertError.message}`,
      );
    }

    const subjectIdBySlug = new Map(
      (insertedSubjects || []).map((row) => [
        schoolSubjectKey(schoolSlug, row.slug),
        row.id,
      ]),
    );

    const coursesToInsert = mapCoursesForInsert(
      dedupeCourseRows(courseRows),
      subjectIdBySlug,
      shouldPublish,
    );

    await insertMissingCourses({
      supabase,
      rows: coursesToInsert,
      batchSize,
    });

    await upsertInBatches({
      supabase,
      table: "catalog_course_relationships",
      rows: uniqueBy(
        mapRelationshipsForInsert(relationshipRows),
        (row) => `${row.course_id}::${row.related_course_id}::${row.relationship_type}`,
      ),
      batchSize,
      onConflict: "course_id,related_course_id,relationship_type",
    });

    await upsertInBatches({
      supabase,
      table: "catalog_course_attributes",
      rows: uniqueBy(
        mapAttributesForInsert(attributeRows),
        (row) => `${row.course_id}::${row.attribute_text}`,
      ),
      batchSize,
      onConflict: "course_id,attribute_text",
    });

    await upsertInBatches({
      supabase,
      table: "catalog_course_offerings",
      rows: uniqueBy(
        mapOfferingsForInsert(courseRows, subjectRows, shouldPublish),
        (row) => `${row.course_id}::${row.school_slug}::${row.subject_slug}`,
      ),
      batchSize,
      onConflict: "course_id,school_slug,subject_slug",
    });
  }
}

function readAllSchoolScrapes() {
  const allData = JSON.parse(readFileSync(ALL_COURSES_PATH, "utf8"));
  return Object.entries(allData || {}).filter(
    ([, schoolData]) =>
      schoolData?.courses && typeof schoolData.courses === "object",
  );
}

function buildCombinedSummary(normalizedDatasets) {
  const counts = {};
  const issueCounts = {};

  for (const normalized of normalizedDatasets) {
    const summary = buildImportSummary(normalized);
    for (const [key, value] of Object.entries(summary.counts || {})) {
      counts[key] = (counts[key] || 0) + (Number(value) || 0);
    }
    for (const [key, value] of Object.entries(summary.issueCounts || {})) {
      issueCounts[key] = (issueCounts[key] || 0) + (Number(value) || 0);
    }
  }

  return {
    school: "all",
    counts,
    issueCounts,
    sourceFile: "scraped-data/all-courses.json",
  };
}

function combineNormalizedRows(normalizedDatasets) {
  return normalizedDatasets.reduce(
    (acc, normalized) => {
      acc.schools.push(normalized.school);
      acc.subjects.push(...normalized.subjects);
      acc.courses.push(...normalized.courses);
      acc.relationships.push(...normalized.relationships);
      acc.attributes.push(...normalized.attributes);
      return acc;
    },
    {
      schools: [],
      subjects: [],
      courses: [],
      relationships: [],
      attributes: [],
    },
  );
}

async function replaceAllCatalog({
  supabase,
  normalizedDatasets,
  shouldPublish,
  batchSize,
}) {
  const rows = combineNormalizedRows(normalizedDatasets);

  for (const schoolRow of rows.schools) {
    await upsertSchool(supabase, schoolRow, shouldPublish);
  }

  const { error: deleteSubjectsError } = await supabase
    .from("catalog_subjects")
    .delete()
    .not("id", "is", null);

  if (deleteSubjectsError) {
    throw new Error(
      `Failed to delete existing catalog subjects: ${deleteSubjectsError.message}`,
    );
  }

  const subjectsToInsert = mapSubjectsForInsert(rows.subjects, shouldPublish);
  const { data: insertedSubjects, error: subjectInsertError } = await supabase
    .from("catalog_subjects")
    .insert(subjectsToInsert)
    .select("id, school_slug, slug");

  if (subjectInsertError) {
    throw new Error(
      `Failed to insert catalog subjects: ${subjectInsertError.message}`,
    );
  }

  const subjectIdBySlug = new Map(
    (insertedSubjects || []).map((row) => [
      schoolSubjectKey(row.school_slug, row.slug),
      row.id,
    ]),
  );
  const coursesToInsert = mapCoursesForInsert(
    dedupeCourseRows(rows.courses),
    subjectIdBySlug,
    shouldPublish,
  );

  await insertMissingCourses({
    supabase,
    rows: coursesToInsert,
    batchSize,
  });

  await upsertInBatches({
    supabase,
    table: "catalog_course_relationships",
    rows: uniqueBy(
      mapRelationshipsForInsert(rows.relationships),
      (row) => `${row.course_id}::${row.related_course_id}::${row.relationship_type}`,
    ),
    batchSize,
    onConflict: "course_id,related_course_id,relationship_type",
  });

  await upsertInBatches({
    supabase,
    table: "catalog_course_attributes",
    rows: uniqueBy(
      mapAttributesForInsert(rows.attributes),
      (row) => `${row.course_id}::${row.attribute_text}`,
    ),
    batchSize,
    onConflict: "course_id,attribute_text",
  });

  await upsertInBatches({
    supabase,
    table: "catalog_course_offerings",
    rows: uniqueBy(
      mapOfferingsForInsert(rows.courses, rows.subjects, shouldPublish),
      (row) => `${row.course_id}::${row.school_slug}::${row.subject_slug}`,
    ),
    batchSize,
    onConflict: "course_id,school_slug,subject_slug",
  });
}

function printImportSummary({
  schoolSlug,
  shouldPublish,
  dryRun,
  batchSize,
  summary,
}) {
  const counts = summary.counts || {};
  const issueCounts = summary.issueCounts || {};

  console.log(`${dryRun ? "Validated" : "Imported"} catalog for ${schoolSlug}`);
  console.log(`Published: ${shouldPublish ? "yes" : "no"}`);
  console.log(`Batch size: ${batchSize}`);
  console.log("");
  console.log("Counts:");
  console.log(`  Subjects: ${counts.subjects ?? 0}`);
  console.log(`  Courses: ${counts.courses ?? 0}`);
  console.log(`  Published courses: ${counts.publishedCourses ?? 0}`);
  console.log(
    `  Variable-credit courses: ${counts.variableCreditCourses ?? 0}`,
  );
  console.log(`  Placeholder courses: ${counts.placeholderCourses ?? 0}`);
  console.log(`  Relationships: ${counts.relationships ?? 0}`);
  console.log(
    `  Unresolved relationships: ${counts.unresolvedRelationships ?? 0}`,
  );
  console.log(`  Attributes: ${counts.attributes ?? 0}`);
  console.log(`  Duplicate course IDs: ${counts.duplicateCourseIds ?? 0}`);

  const entries = Object.entries(issueCounts).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  console.log("");
  console.log("Issue counts:");
  if (entries.length === 0) {
    console.log("  none");
  } else {
    for (const [issue, count] of entries) {
      console.log(`  ${issue}: ${count}`);
    }
  }
}

async function main() {
  const flags = parseArgs();

  if (flags.help) {
    printUsage();
    return;
  }

  const importAll = Boolean(flags.all);
  const schoolSlug = importAll ? "all" : resolveSchoolSlug(flags);
  const shouldPublish = Boolean(flags.publish);
  const dryRun = Boolean(flags["dry-run"]);
  const batchSize = resolveBatchSize(flags);
  const reportPath = resolveReportPath(flags);

  const normalizedDatasets = importAll
    ? readAllSchoolScrapes().map(([slug, schoolData]) =>
        normalizeSchoolDataset(slug, schoolData, ALL_COURSES_PATH),
      )
    : (() => {
        const { filePath, data } = readSchoolScrape(schoolSlug);
        return [normalizeSchoolDataset(schoolSlug, data, filePath)];
      })();
  const summary = importAll
    ? buildCombinedSummary(normalizedDatasets)
    : buildImportSummary(normalizedDatasets[0]);

  printImportSummary({
    schoolSlug,
    shouldPublish,
    dryRun,
    batchSize,
    summary,
  });

  if (reportPath) {
    writeJsonFile(reportPath, {
      generatedAt: new Date().toISOString(),
      dryRun,
      published: shouldPublish,
      ...summary,
      validation: importAll
        ? normalizedDatasets.map((normalized) => normalized.validationSummary)
        : normalizedDatasets[0].validationSummary,
    });
    console.log("");
    console.log(`Wrote import summary to ${reportPath}`);
  }

  if (dryRun) {
    return;
  }

  const supabase = createAdminClient();
  let importRunId = null;

  try {
    importRunId = await startImportRun(
      supabase,
      schoolSlug,
      summary.sourceFile,
    );

    if (importAll) {
      await replaceAllCatalog({
        supabase,
        normalizedDatasets,
        shouldPublish,
        batchSize,
      });
    } else {
      const normalized = normalizedDatasets[0];
      await upsertSchool(supabase, normalized.school, shouldPublish);

      await replaceSchoolCatalog({
        supabase,
        schoolSlug: normalized.school.slug,
        subjectRows: normalized.subjects,
        courseRows: normalized.courses,
        relationshipRows: normalized.relationships,
        attributeRows: normalized.attributes,
        shouldPublish,
        batchSize,
      });
    }

    await finishImportRun(supabase, importRunId, "completed", {
      dryRun: false,
      published: shouldPublish,
      ...summary,
    });

    console.log("");
    console.log("Supabase import completed successfully.");
  } catch (error) {
    if (importRunId) {
      try {
        await finishImportRun(supabase, importRunId, "failed", {
          dryRun: false,
          published: shouldPublish,
          ...summary,
          error: error instanceof Error ? error.message : String(error),
        });
      } catch (finishError) {
        console.error(
          "Failed to mark import run as failed:",
          finishError instanceof Error ? finishError.message : finishError,
        );
      }
    }

    throw error;
  }
}

main().catch((error) => {
  console.error("Catalog import failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
