import { useEffect, useMemo, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Info,
  MapPinned,
  RotateCcw,
  X,
} from "lucide-react";
import { MAJOR_REQUIREMENTS, SEMESTERS, STUDY_AWAY } from "../../data/courses";

function getSemesterLabel(semesterId) {
  return (
    SEMESTERS.find((semester) => semester.id === semesterId)?.label ||
    semesterId
  );
}

function getSemesterIndex(semesterId) {
  return SEMESTERS.findIndex((semester) => semester.id === semesterId);
}

function sortSemesterIds(semesterIds) {
  return [...semesterIds].sort(
    (a, b) => getSemesterIndex(a) - getSemesterIndex(b),
  );
}

function getSemesterHint(semesterId) {
  if (semesterId === "Y4-Fall") {
    return "Final eligible term before senior spring in Shanghai.";
  }

  return "Common study-away window.";
}

export default function StudyAwayPicker({
  major,
  secondMajor = null,
  studyAway,
  warnings,
  initialSemester,
  onClose,
  onToggleSemester,
  onSetLocation,
}) {
  const dialogTitleId = "study-away-picker-title";
  const dialogDescriptionId = "study-away-picker-description";
  const closeButtonRef = useRef(null);
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  const sortedSelectedSemesters = useMemo(
    () => sortSemesterIds(studyAway.selectedSemesters),
    [studyAway.selectedSemesters],
  );

  const semesterButtonRefs = useRef({});

  const warningsBySemester = useMemo(() => {
    return warnings.reduce((acc, warning) => {
      const semesterId =
        warning.semesterId ||
        STUDY_AWAY.eligibleSemesters.find((id) => warning.id.includes(id));
      if (!semesterId) return acc;
      if (!acc[semesterId]) acc[semesterId] = [];
      acc[semesterId].push(warning);
      return acc;
    }, {});
  }, [warnings]);

  const globalWarnings = useMemo(
    () =>
      warnings.filter((warning) => {
        const semesterId =
          warning.semesterId ||
          STUDY_AWAY.eligibleSemesters.find((id) => warning.id.includes(id));
        return !semesterId;
      }),
    [warnings],
  );

  const selectedCount = sortedSelectedSemesters.length;
  const activeMajors = [major, secondMajor].filter(Boolean);
  const isCsDsMajor = activeMajors.some(
    (majorId) => majorId === "cs" || majorId === "data-science",
  );
  const majorNotes = activeMajors
    .map((majorId) => MAJOR_REQUIREMENTS[majorId]?.studyAwayNotes)
    .filter(Boolean);
  const missingSiteCount = sortedSelectedSemesters.filter(
    (semesterId) => !studyAway.locations[semesterId],
  ).length;
  const maxReached = selectedCount >= STUDY_AWAY.maxSemesters;
  const issueCount = warnings.length;
  const selectionStatus =
    selectedCount === 0
      ? "Select at least 1 semester"
      : missingSiteCount > 0
        ? `${missingSiteCount} site${missingSiteCount === 1 ? "" : "s"} still needed`
        : "Selections complete";
  const nextStep =
    selectedCount === 0
      ? "Pick one eligible semester to satisfy the study-away requirement."
      : missingSiteCount > 0
        ? "Choose a site for each selected semester before finalizing the plan."
        : issueCount > 0
          ? "Review the advising warnings below before using this plan."
          : "Your study-away selections are ready for the graduation check.";

  const clearSelections = () => {
    sortedSelectedSemesters.forEach((semesterId) =>
      onToggleSemester(semesterId),
    );
  };

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    if (!initialSemester) return;

    const targetButton = semesterButtonRefs.current[initialSemester];
    if (!targetButton) return;

    const animationFrame = window.requestAnimationFrame(() => {
      targetButton.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      targetButton.focus();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [initialSemester]);

  return (
    <div className="modal-overlay study-away-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal study-away-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
      >
        <div className="study-away-sheet-handle" aria-hidden="true" />
        <div className="modal-header">
          <div>
            <h2 id={dialogTitleId}>Study Away Planning</h2>
            <p id={dialogDescriptionId} className="study-away-header-copy">
              Select 1 required semester, up to {STUDY_AWAY.maxSemesters} total.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            className="modal-close"
            onClick={onClose}
            aria-label="Close study away picker"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="study-away-layout">
          <div className="study-away-main">
            <div
              className={`study-away-summary ${selectedCount > 0 && missingSiteCount === 0 ? "study-away-summary--ready" : ""}`}
              role="status"
              aria-live="polite"
            >
              {selectedCount > 0 && missingSiteCount === 0 ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <CircleDashed className="h-5 w-5" />
              )}
              <div>
                <span className="study-away-summary-label">Next step</span>
                <p className="study-away-summary-headline">{selectionStatus}</p>
                <p className="study-away-summary-tip">{nextStep}</p>
              </div>
            </div>

            {globalWarnings.length > 0 && (
              <div className="study-away-warnings">
                {globalWarnings.map((warning) => (
                  <div className="study-away-warning-item" key={warning.id}>
                    <AlertTriangle className="h-4 w-4" />
                    <span>{warning.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="study-away-semester-list">
              {STUDY_AWAY.eligibleSemesters.map((semesterId) => {
                const isSelected =
                  studyAway.selectedSemesters.includes(semesterId);
                const location = studyAway.locations[semesterId] || "";
                const semesterWarnings = warningsBySemester[semesterId] || [];
                const selectionDisabled = !isSelected && maxReached;
                const hasWarnings = semesterWarnings.length > 0;
                const statusClass = isSelected
                  ? hasWarnings || !location
                    ? "study-away-status--warning"
                    : "study-away-status--success"
                  : "";

                return (
                  <div
                    key={semesterId}
                    className={`study-away-semester-row ${isSelected ? "study-away-semester-row--active" : ""} ${hasWarnings ? "study-away-semester-row--warning" : ""} ${selectionDisabled ? "study-away-semester-row--disabled" : ""}`}
                  >
                    <div className="study-away-semester-main">
                      <div className="study-away-semester-details">
                        <button
                          type="button"
                          ref={(element) => {
                            semesterButtonRefs.current[semesterId] = element;
                          }}
                          className="study-away-semester-toggle"
                          onClick={() => onToggleSemester(semesterId)}
                          aria-pressed={isSelected}
                          disabled={selectionDisabled}
                        >
                          <span
                            className={`study-away-semester-check ${isSelected ? "study-away-semester-check--active" : ""}`}
                          >
                            {isSelected ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <CircleDashed className="h-4 w-4" />
                            )}
                          </span>
                          <span className="study-away-semester-label-stack">
                            <span className="study-away-semester-label">
                              {getSemesterLabel(semesterId)}
                            </span>
                            <span className="study-away-semester-window">
                              Eligible term
                            </span>
                          </span>
                        </button>
                        <p className="study-away-semester-helper">
                          {getSemesterHint(semesterId)}
                        </p>
                      </div>

                      <span
                        className={`study-away-status ${isSelected ? "study-away-status--active" : ""} ${statusClass}`}
                      >
                        {isSelected
                          ? hasWarnings
                            ? "Review issue"
                            : location
                              ? "Ready"
                            : "Needs site"
                          : selectionDisabled
                            ? "Limit reached"
                            : "Not selected"}
                      </span>
                    </div>

                    <div className="study-away-location-stack">
                      {isSelected ? (
                        <>
                          <label className="study-away-location-group">
                            <span className="study-away-location-label">
                              <MapPinned className="h-3.5 w-3.5" />
                              Site
                            </span>
                            <select
                              value={location}
                              onChange={(event) =>
                                onSetLocation(semesterId, event.target.value)
                              }
                              aria-label={`Study away site for ${getSemesterLabel(semesterId)}`}
                            >
                              <option value="">Select a site</option>
                              {STUDY_AWAY.locations.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>

                        </>
                      ) : null}

                      {semesterWarnings.length > 0 && (
                        <div className="study-away-row-warnings">
                          {semesterWarnings.map((warning) => (
                            <div
                              className="study-away-warning-item"
                              key={warning.id}
                            >
                              <AlertTriangle className="h-4 w-4" />
                              <span>{warning.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <details className="study-away-notes">
              <summary>
                <Info className="h-3.5 w-3.5" />
                Policy and advising notes
              </summary>
              <ul>
                {STUDY_AWAY.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>

              {isCsDsMajor && (
                <>
                  <div className="study-away-notes-heading study-away-subheading">
                    <Info className="h-3.5 w-3.5" />
                    <h3>CS/DS advising</h3>
                  </div>
                  {majorNotes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                  <ul>
                    {(STUDY_AWAY.csdsAdvisingNotes || []).map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </>
              )}
            </details>
            <div className="study-away-actions">
              <button
                type="button"
                className="study-away-action-btn study-away-action-btn--secondary"
                onClick={clearSelections}
                disabled={selectedCount === 0}
              >
                <RotateCcw className="h-4 w-4" />
                Clear
              </button>
              <button
                type="button"
                className="study-away-action-btn study-away-action-btn--primary"
                onClick={onClose}
                disabled={selectedCount === 0 || missingSiteCount > 0}
              >
                <CheckCircle2 className="h-4 w-4" />
                {selectedCount === 0
                  ? "Select a semester"
                  : missingSiteCount > 0
                    ? `Choose ${missingSiteCount} site${missingSiteCount === 1 ? "" : "s"}`
                    : "Done"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
