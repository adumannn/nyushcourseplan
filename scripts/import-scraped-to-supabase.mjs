#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import {
  buildImportSummary,
  loadProjectEnv,
  normalizeSchoolDataset,
  parseArgs,
  readSchoolScrape,
  resolveSchoolSlug,
  writeJsonFile,
} from "./lib/catalog-normalize.mjs";

const DEFAULT_BATCH_SIZE = 500;

function printUsage() {
  console.log(
    `
Usage:
  node scripts/import-scraped-to-supabase.mjs
  node scripts/import-scraped-to-supabase.mjs --school shanghai
  node scripts/import-scraped-to-supabase.mjs --publish
  node scripts/import-scraped-to-supabase.mjs --dry-run
  node scripts/import-scraped-to-supabase.mjs --batch-size 250

Options:
  --school <slug>       School file to import. Defaults to "shanghai".
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
    const subjectId = subjectIdBySlug.get(row.subject_slug);
    if (!subjectId) {
      throw new Error(
        `Unable to resolve subject id for subject slug "${row.subject_slug}" while importing course "${row.id}".`,
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
      (insertedSubjects || []).map((row) => [row.slug, row.id]),
    );

    const coursesToInsert = mapCoursesForInsert(
      courseRows,
      subjectIdBySlug,
      shouldPublish,
    );

    await insertInBatches({
      supabase,
      table: "catalog_courses",
      rows: coursesToInsert,
      batchSize,
    });

    await insertInBatches({
      supabase,
      table: "catalog_course_relationships",
      rows: mapRelationshipsForInsert(relationshipRows),
      batchSize,
    });

    await insertInBatches({
      supabase,
      table: "catalog_course_attributes",
      rows: mapAttributesForInsert(attributeRows),
      batchSize,
    });
  }
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

  const schoolSlug = resolveSchoolSlug(flags);
  const shouldPublish = Boolean(flags.publish);
  const dryRun = Boolean(flags["dry-run"]);
  const batchSize = resolveBatchSize(flags);
  const reportPath = resolveReportPath(flags);

  const { filePath, data } = readSchoolScrape(schoolSlug);
  const normalized = normalizeSchoolDataset(schoolSlug, data, filePath);
  const summary = buildImportSummary(normalized);

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
      validation: normalized.validationSummary,
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
      normalized.school.slug,
      normalized.school.source_file,
    );

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
