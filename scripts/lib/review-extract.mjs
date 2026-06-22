import { createHash } from "node:crypto";

export const EVIDENCE_SEP = "\n";

export function sha256Hex(input) {
  return createHash("sha256").update(String(input), "utf8").digest("hex");
}

export function isStub(s) {
  if (!s) return true;
  const t = String(s).trim().toLowerCase();
  return (
    t === "" || t === "unstated" || t === "n/a" || t === "none" ||
    t === "not stated" || t === "unknown"
  );
}

export function cleanText(s) {
  return isStub(s) ? "" : String(s).trim();
}

export function asString(v) {
  return typeof v === "string" ? v : "";
}

export function asStringArray(v) {
  return Array.isArray(v) ? v.map((x) => asString(x).trim()).filter(Boolean) : [];
}

// Round-robin: catalog[i] -> slice[i % k]. Spreads high-traffic departments
// across slices so no single slice's model output is disproportionately large.
// Slicing only bounds OUTPUT — every course is in exactly one slice and the
// full doc is always sent, so no review context is lost.
export function buildCatalogSlices(catalog, k) {
  const n = Math.max(1, Number(k) || 1);
  const slices = Array.from({ length: n }, () => []);
  catalog.forEach((c, i) => slices[i % n].push(c));
  return slices.filter((s) => s.length > 0);
}
