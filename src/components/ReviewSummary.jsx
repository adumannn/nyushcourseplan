import { useState } from "react";
import { MessageSquare, ChevronDown, ChevronRight } from "lucide-react";
import useCourseReviews from "../hooks/useCourseReviews";

function formatRelative(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function Chip({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs">
      <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function ProfessorCard({ review }) {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="rounded-md border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="flex flex-col">
          <span className="text-sm font-medium">{review.professor_name}</span>
          {review.summary_en && (
            <span className="text-xs text-muted-foreground line-clamp-1">
              {review.summary_en}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground/70 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground/70 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-border/60 px-3 py-2.5 text-sm">
          {review.summary_en && (
            <p className="text-muted-foreground">{review.summary_en}</p>
          )}
          {review.teaching_style_en && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">
                Teaching style
              </div>
              <p className="text-muted-foreground">{review.teaching_style_en}</p>
            </div>
          )}
          {Array.isArray(review.pros_en) && review.pros_en.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">
                Pros
              </div>
              <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                {review.pros_en.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(review.cons_en) && review.cons_en.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">
                Cons
              </div>
              <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                {review.cons_en.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {review.raw_zh && (
            <div>
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="text-xs text-muted-foreground/80 underline underline-offset-2 hover:text-foreground"
              >
                {showRaw ? "Hide original (Chinese)" : "Show original (Chinese)"}
              </button>
              {showRaw && (
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs text-muted-foreground">
                  {review.raw_zh}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReviewSummary({ courseId }) {
  const { courseReview, professorReviews, loading } = useCourseReviews(courseId);

  if (loading) return null;

  const hasCourseReview =
    !!courseReview &&
    (courseReview.summary_en ||
      courseReview.difficulty_en ||
      courseReview.workload_en ||
      (courseReview.key_points_en?.length ?? 0) > 0);
  const hasProfReviews = professorReviews.length > 0;

  if (!hasCourseReview && !hasProfReviews) return null;

  const mostRecent = [courseReview?.updated_at, ...professorReviews.map((r) => r.updated_at)]
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground/60" />
        <span className="text-xs tracking-wider uppercase text-muted-foreground font-medium">
          Community reviews
        </span>
      </div>

      <div className="space-y-3 ml-6">
        {hasCourseReview && (
          <div className="space-y-2">
            {(courseReview.difficulty_en || courseReview.workload_en) && (
              <div className="flex flex-wrap gap-1.5">
                <Chip label="Difficulty" value={courseReview.difficulty_en} />
                <Chip label="Workload" value={courseReview.workload_en} />
              </div>
            )}
            {courseReview.summary_en && (
              <p className="text-sm text-muted-foreground">
                {courseReview.summary_en}
              </p>
            )}
            {Array.isArray(courseReview.key_points_en) &&
              courseReview.key_points_en.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-0.5">
                  {courseReview.key_points_en.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
          </div>
        )}

        {hasProfReviews && (
          <div className="space-y-1.5">
            {professorReviews.map((r) => (
              <ProfessorCard key={r.id} review={r} />
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground/70">
          Summaries are AI-generated from the community Google Doc
          {mostRecent ? ` · updated ${formatRelative(mostRecent)}` : ""}.
        </p>
      </div>
    </div>
  );
}
