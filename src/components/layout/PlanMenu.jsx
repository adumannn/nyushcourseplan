import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Combine,
  Download,
  FileUp,
  Upload,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import {
  exportPlanAsCSV,
  exportPlanAsPDF,
  importPlanFromCSV,
} from "../../lib/planTransfer";
import { SEMESTERS, getMajorLabel } from "../../data/courses";

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function summarizePlan(plan) {
  const bySemester = {};
  let courseCount = 0;
  let customCourseCount = 0;

  SEMESTERS.forEach((semester) => {
    const courses = Array.isArray(plan?.[semester.id]) ? plan[semester.id] : [];
    bySemester[semester.id] = courses.length;
    courseCount += courses.length;
    customCourseCount += courses.filter((course) =>
      String(course?.id || "").startsWith("custom-"),
    ).length;
  });

  return {
    courseCount,
    customCourseCount,
    bySemester,
  };
}

function resolveImportParser(file) {
  const filename = (file?.name || "").toLowerCase();
  const mimeType = (file?.type || "").toLowerCase();

  if (
    filename.endsWith(".csv") ||
    mimeType.includes("text/csv") ||
    mimeType.includes("application/csv")
  ) {
    return { parser: importPlanFromCSV, label: "CSV" };
  }

  throw new Error("Unsupported file type. Please import a .csv file.");
}

export default function PlanMenu({
  plan,
  major,
  studentName,
  studyAway,
  totalCredits,
  semesterCredits,
  onImport,
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (!importOpen) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setImportOpen(false);
        setDragActive(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [importOpen]);

  const closeMenu = () => setOpen(false);

  const announceStatus = useCallback((tone, message) => {
    setStatus({ tone, message });
  }, []);

  const handleExportCSV = () => {
    closeMenu();
    try {
      const result = exportPlanAsCSV({ plan, studentName });
      announceStatus(
        "success",
        `Exported ${pluralize(result.courseCount, "course")} to ${result.filename}.`,
      );
    } catch (err) {
      announceStatus("error", err?.message || "Failed to export CSV.");
    }
  };

  const handleExportPDF = () => {
    closeMenu();
    try {
      const result = exportPlanAsPDF({
        plan,
        major,
        studentName,
        studyAway,
        totalCredits,
        semesterCredits,
      });
      announceStatus(
        "success",
        `Opened print preview for ${pluralize(result.courseCount, "course")}.`,
      );
    } catch (err) {
      announceStatus("error", err?.message || "Failed to export PDF.");
    }
  };

  const resetImportState = () => {
    setImportError("");
    setImportPreview(null);
    setImportLoading(false);
    setDragActive(false);
  };

  const openImportModal = () => {
    closeMenu();
    resetImportState();
    setImportOpen(true);
  };

  const runImportPreview = async (file) => {
    if (!file) return;

    setImportLoading(true);
    setImportError("");
    setImportPreview(null);

    try {
      const { parser, label } = resolveImportParser(file);
      const result = await parser(file);
      const summary = result?.summary || summarizePlan(result?.plan);
      const warnings = Array.isArray(result?.warnings) ? result.warnings : [];

      setImportPreview({
        fileName: file.name,
        label,
        result,
        summary,
        warnings,
      });
    } catch (err) {
      setImportError(err?.message || "Failed to import file.");
    } finally {
      setImportLoading(false);
      setDragActive(false);
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    await runImportPreview(file);
  };

  const applyImport = (mode) => {
    if (!importPreview?.result) return;

    onImport(importPreview.result, mode);

    const importedCount = importPreview.summary?.courseCount ?? 0;
    announceStatus(
      "success",
      `${mode === "merge" ? "Merged" : "Replaced with"} ${pluralize(importedCount, "course")} from ${importPreview.fileName}.`,
    );

    setImportOpen(false);
    resetImportState();
  };

  const populatedSemesters = useMemo(() => {
    if (!importPreview?.summary?.bySemester) return [];

    return SEMESTERS.map((semester) => ({
      id: semester.id,
      label: semester.label,
      count: importPreview.summary.bySemester[semester.id] || 0,
    })).filter((semester) => semester.count > 0);
  }, [importPreview]);

  const importMajorLabel =
    importPreview?.result?.major && typeof importPreview.result.major === "string"
      ? getMajorLabel(importPreview.result.major)
      : "";

  const importStudentName =
    typeof importPreview?.result?.studentName === "string"
      ? importPreview.result.studentName.trim()
      : "";

  const statusToneClass =
    status?.tone === "error"
      ? "plan-transfer-status--error"
      : "plan-transfer-status--success";

  const statusIcon =
    status?.tone === "error" ? (
      <AlertTriangle className="h-3.5 w-3.5" />
    ) : (
      <CheckCircle2 className="h-3.5 w-3.5" />
    );

  const handleDrop = async (event) => {
    event.preventDefault();
    setDragActive(false);

    const file = event.dataTransfer?.files?.[0];
    await runImportPreview(file);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center rounded-md border transition-colors cursor-pointer ${
          compact
            ? "gap-0 p-2 min-h-[36px] min-w-[36px] justify-center text-xs"
            : "gap-1.5 px-2.5 py-1.5 text-xs"
        } ${
          open
            ? "border-[#57068c]/45 bg-[#57068c]/10 text-foreground"
            : "border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        title="Import or export plan"
        aria-label="Import or export plan"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        {!compact && (
          <>
            <span>Plan</span>
            <ChevronDown
              className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="text/csv,application/csv,.csv"
        className="hidden"
        onChange={handleFileSelected}
      />

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-70 overflow-hidden"
        >
          <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Import
          </div>
          <button
            role="menuitem"
            onClick={openImportModal}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            Import File
          </button>

          <div className="border-t border-border/40 my-1" />
          <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Export
          </div>
          <button
            role="menuitem"
            onClick={handleExportCSV}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            As CSV
          </button>
          <button
            role="menuitem"
            onClick={handleExportPDF}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            As PDF
          </button>
        </div>
      )}

      {status && (
        <div
          className={`plan-transfer-status ${statusToneClass}`}
          role="status"
          aria-live="polite"
        >
          {statusIcon}
          <span>{status.message}</span>
        </div>
      )}

      {importOpen && (
        <div className="modal-overlay" onClick={() => setImportOpen(false)}>
          <div
            className="modal plan-transfer-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-transfer-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="plan-transfer-title">Import Plan</h2>
                <p className="plan-transfer-header-copy">
                  Upload a CSV export, preview it, then merge or replace your
                  current plan.
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setImportOpen(false)}
                aria-label="Close import dialog"
              >
                ×
              </button>
            </div>

            <div className="plan-transfer-body">
              <div
                className={`plan-transfer-dropzone ${dragActive ? "plan-transfer-dropzone--active" : ""} ${importLoading ? "plan-transfer-dropzone--busy" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
              >
                <FileUp className="h-5 w-5" />
                <div className="plan-transfer-dropzone-copy">
                  <p>Drop a plan file here</p>
                  <span>or</span>
                  <button
                    type="button"
                    className="plan-transfer-link-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importLoading}
                  >
                    choose a file
                  </button>
                </div>
                <small>Supported: .csv</small>
              </div>

              {importLoading && (
                <div className="plan-transfer-feedback" role="status">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  <span>Reading and validating your file...</span>
                </div>
              )}

              {importError && (
                <div className="plan-transfer-feedback plan-transfer-feedback--error">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{importError}</span>
                </div>
              )}

              {importPreview && (
                <div className="plan-transfer-preview">
                  <div className="plan-transfer-preview-head">
                    <h3>{importPreview.fileName}</h3>
                    <span className="plan-transfer-badge">
                      {importPreview.label}
                    </span>
                  </div>

                  <div className="plan-transfer-metrics">
                    <div className="plan-transfer-metric">
                      <span>Courses</span>
                      <strong>
                        {importPreview.summary?.courseCount ?? 0}
                      </strong>
                    </div>
                    <div className="plan-transfer-metric">
                      <span>Custom</span>
                      <strong>
                        {importPreview.summary?.customCourseCount ?? 0}
                      </strong>
                    </div>
                    <div className="plan-transfer-metric">
                      <span>Semesters</span>
                      <strong>{populatedSemesters.length}</strong>
                    </div>
                  </div>

                  {(importMajorLabel || importStudentName) && (
                    <div className="plan-transfer-meta">
                      {importMajorLabel && <span>Major: {importMajorLabel}</span>}
                      {importStudentName && (
                        <span>Student: {importStudentName}</span>
                      )}
                    </div>
                  )}

                  {populatedSemesters.length > 0 && (
                    <div className="plan-transfer-semesters">
                      {populatedSemesters.map((semester) => (
                        <span key={semester.id} className="plan-transfer-chip">
                          {semester.label}: {semester.count}
                        </span>
                      ))}
                    </div>
                  )}

                  {importPreview.warnings?.length > 0 && (
                    <div className="plan-transfer-warnings">
                      {importPreview.warnings.map((warning) => (
                        <div key={warning} className="plan-transfer-warning-item">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>{warning}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="plan-transfer-actions">
                    <button
                      type="button"
                      className="plan-transfer-action-btn plan-transfer-action-btn--merge"
                      onClick={() => applyImport("merge")}
                    >
                      <Combine className="h-4 w-4" />
                      Merge Into Current Plan
                    </button>
                    <button
                      type="button"
                      className="plan-transfer-action-btn plan-transfer-action-btn--replace"
                      onClick={() => applyImport("replace")}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Replace Current Plan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
