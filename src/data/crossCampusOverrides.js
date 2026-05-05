// Hand-curated cross-campus equivalence overrides applied by
// scripts/generate-local-catalog.mjs.
//
// The generator auto-detects equivalents by matching (normalized name,
// credits, subject family). Use these lists only for cases the heuristic
// misses or false positives the heuristic catches.

// Force-merge: courses to be treated as equivalent across campuses despite
// differing names/credits. Each entry is an array of course IDs that
// should collapse into a single canonical entry.
export const FORCE_EQUIVALENT = [];

// Force-split: course IDs that the heuristic would otherwise merge but that
// are in fact different courses (same name, different content). Each entry
// is an array of IDs to keep separate.
export const NOT_EQUIVALENT = [];
