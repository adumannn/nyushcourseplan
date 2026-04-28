import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Mail,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { getSupabaseClientWithAuth } from "../../lib/supabase";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "done", label: "Done" },
  { value: "ignored", label: "Ignored" },
];

const STATUS_FILTERS = [
  { value: "active", label: "Active" },
  { value: "all", label: "All" },
  ...STATUS_OPTIONS,
];

const CATEGORY_LABELS = {
  feature: "Feature",
  bug: "Bug",
  "course-data": "Course data",
  usability: "Usability",
  other: "Other",
};

const SELECT_COLUMNS = [
  "id",
  "user_id",
  "category",
  "message",
  "contact_email",
  "contact_name",
  "page_path",
  "plan_id",
  "major",
  "total_credits",
  "user_agent",
  "status",
  "admin_notes",
  "reviewed_at",
  "created_at",
].join(",");

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeStatus(value) {
  return value || "new";
}

export default function SuggestionInbox({ onClose, getToken, user }) {
  const [suggestions, setSuggestions] = useState([]);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [statusFilter, setStatusFilter] = useState("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const db = await getSupabaseClientWithAuth(getToken);
      if (!db) throw new Error("Supabase not available");

      const { data, error: loadError } = await db
        .from("suggestions")
        .select(SELECT_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(200);

      if (loadError) throw loadError;

      setSuggestions(data || []);
      setNoteDrafts(
        Object.fromEntries((data || []).map((row) => [row.id, row.admin_notes || ""])),
      );
    } catch (err) {
      console.error("[SuggestionInbox] load failed:", err);
      setError(err.message || "Could not load suggestions.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const filteredSuggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return suggestions.filter((suggestion) => {
      const status = normalizeStatus(suggestion.status);
      if (
        statusFilter === "active" &&
        (status === "done" || status === "ignored")
      ) {
        return false;
      }
      if (statusFilter !== "active" && statusFilter !== "all" && status !== statusFilter) {
        return false;
      }
      if (categoryFilter !== "all" && suggestion.category !== categoryFilter) {
        return false;
      }
      if (!needle) return true;

      return [
        suggestion.message,
        suggestion.contact_email,
        suggestion.contact_name,
        suggestion.major,
        suggestion.page_path,
        suggestion.admin_notes,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [categoryFilter, query, statusFilter, suggestions]);

  const counts = useMemo(() => {
    return suggestions.reduce(
      (acc, suggestion) => {
        const status = normalizeStatus(suggestion.status);
        acc.total += 1;
        acc[status] = (acc[status] || 0) + 1;
        if (status !== "done" && status !== "ignored") acc.active += 1;
        return acc;
      },
      { active: 0, total: 0, new: 0, reviewing: 0, done: 0, ignored: 0 },
    );
  }, [suggestions]);

  const updateSuggestion = async (id, values) => {
    setSavingId(id);
    setError("");

    try {
      const db = await getSupabaseClientWithAuth(getToken);
      if (!db) throw new Error("Supabase not available");

      const { data, error: updateError } = await db
        .from("suggestions")
        .update(values)
        .eq("id", id)
        .select(SELECT_COLUMNS)
        .single();

      if (updateError) throw updateError;

      setSuggestions((current) =>
        current.map((suggestion) => (suggestion.id === id ? data : suggestion)),
      );
      setNoteDrafts((current) => ({
        ...current,
        [id]: data.admin_notes || "",
      }));
    } catch (err) {
      console.error("[SuggestionInbox] update failed:", err);
      setError(err.message || "Could not update suggestion.");
    } finally {
      setSavingId("");
    }
  };

  const handleStatusChange = (suggestion, status) => {
    updateSuggestion(suggestion.id, {
      status,
      reviewed_at: status === "new" ? null : new Date().toISOString(),
    });
  };

  const handleSaveNote = (suggestion) => {
    updateSuggestion(suggestion.id, {
      admin_notes: noteDrafts[suggestion.id]?.trim() || null,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width: "min(920px, 96vw)", maxWidth: 920, maxHeight: "88vh" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <h2>Feedback Inbox</h2>
            <p className="modal-subtitle">
              {counts.active} active, {counts.total} total
            </p>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close feedback inbox"
          >
            &times;
          </button>
        </div>

        <div className="border-b border-border p-3 flex flex-col gap-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="modal-search-shell flex-1">
              <Search className="modal-search-icon h-4 w-4" />
              <input
                className="modal-search modal-search--with-icon"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search message, email, name, page, notes..."
              />
            </label>
            <div className="flex gap-2">
              <select
                className="rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter feedback by status"
              >
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                    {option.value in counts ? ` (${counts[option.value]})` : ""}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Filter feedback by category"
              >
                <option value="all">All categories</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-border px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={loadSuggestions}
                disabled={loading}
                aria-label="Refresh feedback"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
            {STATUS_OPTIONS.map((option) => (
              <span
                key={option.value}
                className="rounded-full border border-border/70 px-2 py-1"
              >
                {option.label}: {counts[option.value] || 0}
              </span>
            ))}
            <span className="rounded-full border border-border/70 px-2 py-1">
              Admin ID: {user?.id || "unknown"}
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-red-500/25 bg-red-500/8 p-3 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="modal-empty">Loading feedback...</div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="modal-empty">
              <Inbox className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
              No feedback matches these filters.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredSuggestions.map((suggestion) => {
                const status = normalizeStatus(suggestion.status);
                const isSaving = savingId === suggestion.id;
                const noteChanged =
                  (noteDrafts[suggestion.id] || "") !==
                  (suggestion.admin_notes || "");

                return (
                  <article
                    key={suggestion.id}
                    className="rounded-lg border border-border bg-card p-3 shadow-sm"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium">
                            {CATEGORY_LABELS[suggestion.category] || suggestion.category}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(suggestion.created_at)}
                          </span>
                          {suggestion.major && (
                            <span className="text-xs text-muted-foreground">
                              {suggestion.major}
                            </span>
                          )}
                          {Number.isFinite(suggestion.total_credits) && (
                            <span className="text-xs text-muted-foreground">
                              {suggestion.total_credits} cr
                            </span>
                          )}
                        </div>

                        <p className="whitespace-pre-wrap text-sm leading-5 text-foreground">
                          {suggestion.message}
                        </p>
                      </div>

                      <select
                        className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none"
                        value={status}
                        onChange={(event) =>
                          handleStatusChange(suggestion, event.target.value)
                        }
                        disabled={isSaving}
                        aria-label="Update feedback status"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {suggestion.contact_email && (
                        <a
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-accent hover:text-foreground"
                          href={`mailto:${suggestion.contact_email}`}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {suggestion.contact_email}
                        </a>
                      )}
                      {suggestion.contact_name && (
                        <span className="rounded-md border border-border px-2 py-1">
                          {suggestion.contact_name}
                        </span>
                      )}
                      {suggestion.page_path && (
                        <span className="rounded-md border border-border px-2 py-1">
                          {suggestion.page_path}
                        </span>
                      )}
                      {suggestion.reviewed_at && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {formatDate(suggestion.reviewed_at)}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-col gap-2 md:flex-row">
                      <textarea
                        className="suggestion-textarea min-h-[72px] flex-1"
                        value={noteDrafts[suggestion.id] || ""}
                        onChange={(event) =>
                          setNoteDrafts((current) => ({
                            ...current,
                            [suggestion.id]: event.target.value,
                          }))
                        }
                        placeholder="Private triage notes..."
                      />
                      <button
                        type="button"
                        className="btn-primary md:self-start"
                        onClick={() => handleSaveNote(suggestion)}
                        disabled={!noteChanged || isSaving}
                      >
                        <Save className="h-4 w-4" />
                        {isSaving ? "Saving..." : "Save note"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
