import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Files,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

export default function PlanSwitcher({
  plans,
  planId,
  planName,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (event.key === "Escape" || !rootRef.current?.contains(event.target)) {
        setOpen(false);
        setMode(null);
        setError("");
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      setOpen(false);
      setMode(null);
    } catch (nextError) {
      setError(nextError?.message || "Plan action failed.");
    } finally {
      setBusy(false);
    }
  };

  const edit = (nextMode) => {
    setMode(nextMode);
    setValue(nextMode === "rename" ? planName : `Plan ${plans.length + 1}`);
    setError("");
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-md border border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground ${
          compact ? "h-9 w-9" : "max-w-44 px-2.5 py-1.5 text-sm"
        }`}
        title={`Current plan: ${planName}`}
        aria-label={`Current plan: ${planName}. Open plan switcher`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Files className="h-4 w-4 shrink-0" />
        {!compact && <span className="truncate">{planName}</span>}
        {!compact && <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-24px)] rounded-lg border border-border bg-card p-2 text-foreground shadow-xl">
          <div className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Plans
          </div>
          <div className="max-h-48 overflow-y-auto">
            {plans.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Plans could not be loaded. You can retry by refreshing.
              </p>
            )}
            {plans.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={busy || item.id === planId}
                onClick={() => run(() => onSwitch(item.id))}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent disabled:cursor-default disabled:opacity-70"
                role="menuitem"
              >
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                {item.id === planId && <Check className="h-4 w-4 text-[#57068c]" />}
              </button>
            ))}
          </div>

          <div className="my-1 border-t border-border/50" />

          {mode === "new" || mode === "rename" ? (
            <form
              className="space-y-2 p-1"
              onSubmit={(event) => {
                event.preventDefault();
                const name = value.trim();
                if (!name) return;
                run(() => (mode === "new" ? onCreate(name) : onRename(name)));
              }}
            >
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                maxLength={80}
                autoFocus
                className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-[#57068c]/60"
                aria-label={mode === "new" ? "New plan name" : "Rename plan"}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !value.trim()}
                  className="rounded-md bg-[#57068c] px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {mode === "new" ? "Create" : "Save"}
                </button>
              </div>
            </form>
          ) : mode === "delete" ? (
            <div className="space-y-2 p-2 text-sm break-words">
              <p>Delete “{planName}”?</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy || plans.length <= 1}
                  onClick={() => run(onDelete)}
                  className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => edit("new")}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
              >
                <Plus className="h-4 w-4" /> New plan
              </button>
              <button
                type="button"
                onClick={() => edit("rename")}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
              >
                <Pencil className="h-4 w-4" /> Rename current plan
              </button>
              <button
                type="button"
                disabled={plans.length <= 1}
                onClick={() => setMode("delete")}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" /> Delete current plan
              </button>
            </div>
          )}

          {error && <p className="px-2 pb-1 pt-2 text-xs text-red-600 break-words">{error}</p>}
        </div>
      )}
    </div>
  );
}
