import { useState } from "react";
import { Send } from "lucide-react";
import { getSupabaseClientWithAuth } from "../../lib/supabase";

const CATEGORY_OPTIONS = [
  { value: "feature", label: "Feature request" },
  { value: "bug", label: "Bug report" },
  { value: "course-data", label: "Course data issue" },
  { value: "other", label: "Other" },
];

export default function SuggestionModal({ onClose, getToken }) {
  const [category, setCategory] = useState("feature");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error

  const canSubmit = message.trim().length > 0 && status === "idle";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStatus("sending");

    try {
      const sb = await getSupabaseClientWithAuth(getToken);
      if (!sb) throw new Error("Supabase not available");

      const { error } = await sb
        .from("suggestions")
        .insert({ category, message: message.trim() });

      if (error) throw error;
      setStatus("sent");
    } catch (err) {
      console.error("[SuggestionModal] submit failed:", err);
      setStatus("error");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Send a Suggestion</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {status === "sent" ? (
          <div className="suggestion-success">
            <div className="suggestion-success-icon">
              <Send className="h-5 w-5" />
            </div>
            <p className="suggestion-success-title">Thanks for your feedback!</p>
            <p className="suggestion-success-body">
              Your suggestion has been recorded. We review every submission.
            </p>
            <button className="btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <div className="suggestion-form">
            <div className="custom-field">
              <label htmlFor="suggestion-category">Category</label>
              <select
                id="suggestion-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="custom-field">
              <label htmlFor="suggestion-message">Your suggestion</label>
              <textarea
                id="suggestion-message"
                className="suggestion-textarea"
                placeholder="Describe your idea, report a bug, or flag a course data issue..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                autoFocus
              />
            </div>

            {status === "error" && (
              <p className="suggestion-error">
                Something went wrong. Please try again or email{" "}
                <a href="mailto:da3762@nyu.edu">da3762@nyu.edu</a>.
              </p>
            )}

            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!canSubmit && status !== "error"}
            >
              {status === "sending" ? "Sending..." : "Submit"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
