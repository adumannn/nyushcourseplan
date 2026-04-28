import { useEffect, useMemo, useState } from "react";
import { Send, X } from "lucide-react";
import { getSupabaseClientWithAuth } from "../../lib/supabase";

const CATEGORY_OPTIONS = [
  { value: "feature", label: "Feature request" },
  { value: "bug", label: "Bug report" },
  { value: "course-data", label: "Course data issue" },
  { value: "usability", label: "Usability issue" },
  { value: "other", label: "Other" },
];

function getPagePath() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function getUserAgent() {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent;
}

function buildFallbackMessage(payload) {
  const details = [
    payload.contact_email ? `Reply email: ${payload.contact_email}` : "",
    payload.contact_name ? `Name: ${payload.contact_name}` : "",
    payload.page_path ? `Page: ${payload.page_path}` : "",
    payload.plan_id ? `Plan: ${payload.plan_id}` : "",
    payload.major ? `Major: ${payload.major}` : "",
    Number.isFinite(payload.total_credits)
      ? `Credits: ${payload.total_credits}`
      : "",
  ].filter(Boolean);

  if (details.length === 0) return payload.message;
  return `${payload.message}\n\n---\n${details.join("\n")}`;
}

async function insertSuggestion(sb, payload) {
  const { error } = await sb.from("suggestions").insert(payload);
  if (!error) return;

  const missingColumn =
    error.code === "PGRST204" ||
    /column|schema cache|could not find/i.test(error.message || "");

  if (!missingColumn) throw error;

  const { error: fallbackError } = await sb.from("suggestions").insert({
    category: payload.category,
    message: buildFallbackMessage(payload),
  });

  if (fallbackError) throw fallbackError;
}

export default function SuggestionModal({
  onClose,
  getToken,
  user,
  plan,
  major,
  totalCredits,
}) {
  const userName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || "";
  const initialContactEmail = user?.email || "";
  const [category, setCategory] = useState("feature");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState(initialContactEmail);
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMessage, setErrorMessage] = useState("");

  const trimmedMessage = message.trim();
  const isSending = status === "sending";
  const canSubmit = trimmedMessage.length > 0 && !isSending;

  const mailtoHref = useMemo(() => {
    const pagePath = getPagePath();
    const subject = encodeURIComponent(`Course planner suggestion: ${category}`);
    const body = encodeURIComponent(
      [
        message,
        "",
        contactEmail ? `Reply email: ${contactEmail}` : "",
        major ? `Major: ${major}` : "",
        Number.isFinite(totalCredits) ? `Credits: ${totalCredits}` : "",
        pagePath ? `Page: ${pagePath}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );

    return `mailto:da3762@nyu.edu?subject=${subject}&body=${body}`;
  }, [category, contactEmail, major, message, totalCredits]);

  useEffect(() => {
    setContactEmail(initialContactEmail);
  }, [initialContactEmail]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && status !== "sending") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, status]);

  const clearError = () => {
    if (status === "error") setStatus("idle");
    if (errorMessage) setErrorMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setStatus("sending");
    setErrorMessage("");

    try {
      const sb = await getSupabaseClientWithAuth(getToken);
      if (!sb) throw new Error("Supabase not available");

      await insertSuggestion(sb, {
        category,
        message: trimmedMessage,
        contact_email: contactEmail.trim() || initialContactEmail || null,
        contact_name: userName || null,
        page_path: getPagePath() || null,
        plan_id: plan?.id || null,
        major: major || null,
        total_credits: Number.isFinite(totalCredits) ? totalCredits : null,
        user_agent: getUserAgent() || null,
      });

      setStatus("sent");
    } catch (err) {
      console.error("[SuggestionModal] submit failed:", err);
      setErrorMessage(
        "We could not save this yet. Try again, or send it by email.",
      );
      setStatus("error");
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={isSending ? undefined : onClose}
    >
      <div
        className="modal suggestion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggestion-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="suggestion-modal-title">Send a Suggestion</h2>
          <button
            className="modal-close"
            onClick={onClose}
            disabled={isSending}
            aria-label="Close suggestion form"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {status === "sent" ? (
          <div className="suggestion-success">
            <div className="suggestion-success-icon">
              <Send className="h-5 w-5" />
            </div>
            <p className="suggestion-success-title">Thanks for your feedback!</p>
            <p className="suggestion-success-body">
              Your suggestion has been recorded. I review every submission if I have enough time.
            </p>
            <button className="btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form className="suggestion-form" onSubmit={handleSubmit}>
            <div className="custom-field">
              <label htmlFor="suggestion-category">Category</label>
              <select
                id="suggestion-category"
                value={category}
                onChange={(e) => {
                  clearError();
                  setCategory(e.target.value);
                }}
                disabled={isSending}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="custom-field">
              <label htmlFor="suggestion-contact">Reply email</label>
              <input
                id="suggestion-contact"
                type="email"
                value={contactEmail}
                onChange={(e) => {
                  clearError();
                  setContactEmail(e.target.value);
                }}
                placeholder="Optional, but useful for follow-up"
                disabled={isSending}
                autoComplete="email"
              />
            </div>

            <div className="custom-field">
              <label htmlFor="suggestion-message">Your suggestion</label>
              <textarea
                id="suggestion-message"
                className="suggestion-textarea"
                placeholder="Describe your idea, report a bug, or flag a course data issue..."
                value={message}
                onChange={(e) => {
                  clearError();
                  setMessage(e.target.value);
                }}
                rows={5}
                autoFocus
                disabled={isSending}
              />
            </div>

            {status === "error" && (
              <p className="suggestion-error">
                {errorMessage}{" "}
                <a href={mailtoHref}>Email da3762@nyu.edu</a>.
              </p>
            )}

            <button
              type="submit"
              className="btn-primary suggestion-submit"
              disabled={!canSubmit}
            >
              {status === "sending" ? (
                "Sending..."
              ) : status === "error" ? (
                "Try again"
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>Submit</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
