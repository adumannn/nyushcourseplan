import { useRef, useState, useEffect } from "react";
import {
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  Printer,
  ChevronDown,
} from "lucide-react";
import {
  exportPlanAsJSON,
  exportPlanAsCSV,
  exportPlanAsPDF,
  importPlanFromJSON,
  importPlanFromCSV,
} from "../lib/planTransfer";

export default function PlanMenu({
  plan,
  major,
  studentName,
  studyAway,
  totalCredits,
  semesterCredits,
  onImport,
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const jsonInputRef = useRef(null);
  const csvInputRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const closeMenu = () => setOpen(false);

  const handleExportJSON = () => {
    closeMenu();
    try {
      exportPlanAsJSON({ plan, major, studentName, studyAway });
    } catch (err) {
      alert(err?.message || "Failed to export JSON.");
    }
  };

  const handleExportCSV = () => {
    closeMenu();
    try {
      exportPlanAsCSV({ plan, studentName });
    } catch (err) {
      alert(err?.message || "Failed to export CSV.");
    }
  };

  const handleExportPDF = () => {
    closeMenu();
    try {
      exportPlanAsPDF({
        plan,
        major,
        studentName,
        studyAway,
        totalCredits,
        semesterCredits,
      });
    } catch (err) {
      alert(err?.message || "Failed to export PDF.");
    }
  };

  const runImport = async (file, parser, label) => {
    if (!file) return;
    try {
      const result = await parser(file);
      const courseCount = Object.values(result.plan || {}).reduce(
        (sum, arr) => sum + (arr?.length || 0),
        0,
      );
      const confirmed = window.confirm(
        `Import ${courseCount} course${courseCount === 1 ? "" : "s"} from ${label}?\n\nThis will replace your current plan.`,
      );
      if (!confirmed) return;
      onImport(result);
    } catch (err) {
      alert(err?.message || `Failed to import ${label}.`);
    }
  };

  const handleJSONSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    await runImport(file, importPlanFromJSON, "JSON");
  };

  const handleCSVSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    await runImport(file, importPlanFromCSV, "CSV");
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
          open
            ? "border-[#57068c]/45 bg-[#57068c]/10 text-foreground"
            : "border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        title="Import or export plan"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="h-3.5 w-3.5" />
        <span>Plan</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <input
        ref={jsonInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleJSONSelected}
      />
      <input
        ref={csvInputRef}
        type="file"
        accept="text/csv,.csv"
        className="hidden"
        onChange={handleCSVSelected}
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
            onClick={() => {
              closeMenu();
              jsonInputRef.current?.click();
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            From JSON
          </button>
          <button
            role="menuitem"
            onClick={() => {
              closeMenu();
              csvInputRef.current?.click();
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            From CSV
          </button>

          <div className="border-t border-border/40 my-1" />
          <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Export
          </div>
          <button
            role="menuitem"
            onClick={handleExportJSON}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <FileJson className="h-4 w-4" />
            As JSON
          </button>
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
            As PDF (Print)
          </button>
        </div>
      )}
    </div>
  );
}
