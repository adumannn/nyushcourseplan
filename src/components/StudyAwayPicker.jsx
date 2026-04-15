import { useEffect, useMemo, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  MapPin,
  PlaneTakeoff,
  X,
} from "lucide-react";
import { MAJOR_REQUIREMENTS, SEMESTERS, STUDY_AWAY } from "../data/courses";

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

function isBlockedLocation(semesterId, location) {
  return (
    semesterId === "Y2-Spring" &&
    (location === "New York" || location === "Abu Dhabi")
  );
}

function getQuickPicksForSemester(semesterId) {
  const defaultPicks = ["London", "Paris", "Sydney", "New York"];
  return defaultPicks.filter(
    (location) =>
      STUDY_AWAY.locations.includes(location) &&
      !isBlockedLocation(semesterId, location),
  );
}

export default function StudyAwayPicker({
  major,
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
  const selectedRatio = Math.min(
    (selectedCount / STUDY_AWAY.maxSemesters) * 100,
    100,
  );
  const isCsDsMajor = major === "cs" || major === "ds";
  const majorNote = MAJOR_REQUIREMENTS[major]?.studyAwayNotes;
  const missingSiteCount = sortedSelectedSemesters.filter(
    (semesterId) => !studyAway.locations[semesterId],
  ).length;
  const maxReached = selectedCount >= STUDY_AWAY.maxSemesters;
  const selectionStatus =
    selectedCount === 0
      ? "Select at least 1 semester"
      : missingSiteCount > 0
        ? `${missingSiteCount} site${missingSiteCount === 1 ? "" : "s"} still needed`
        : "Selections complete";

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
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal study-away-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
      >
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
            ×
          </button>
        </div>

        <div className="study-away-intro">
          <div className="study-away-intro-icon">
            <PlaneTakeoff className="h-4 w-4" />
          </div>
          <div className="study-away-intro-content">
            <p className="study-away-intro-title">
              Eligible window: Sophomore Spring through Senior Fall
            </p>
            <p className="study-away-intro-subtitle">
              Choose your semesters first, then assign a site for each selected
              term.
            </p>
            <div className="study-away-progress">
              <div
                className="study-away-progress-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={STUDY_AWAY.maxSemesters}
                aria-valuenow={selectedCount}
                aria-label="Study away semester selection progress"
              >
                <span style={{ width: `${selectedRatio}%` }} />
              </div>
              <span className="study-away-progress-label">
                {selectedCount}/{STUDY_AWAY.maxSemesters} selected
              </span>
            </div>
          </div>
        </div>

        <div className="study-away-layout">
          <div className="study-away-main">
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
                const quickPicks = getQuickPicksForSemester(semesterId);
                const semesterWarnings = warningsBySemester[semesterId] || [];
                const locationDisabled = !isSelected;
                const selectionDisabled = !isSelected && maxReached;

                return (
                  <div
                    key={semesterId}
                    className={`study-away-semester-row ${isSelected ? "study-away-semester-row--active" : ""} ${selectionDisabled ? "study-away-semester-row--disabled" : ""}`}
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
                          <span className="study-away-semester-check">
                            {isSelected ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <Globe className="h-4 w-4" />
                            )}
                          </span>
                          <span className="study-away-semester-label">
                            {getSemesterLabel(semesterId)}
                          </span>
                        </button>
                        <p className="study-away-semester-helper">
                          {semesterId === "Y2-Spring"
                            ? "Best for an early study-away option."
                            : semesterId === "Y4-Fall"
                              ? "Last eligible term before your final Shanghai semester."
                              : "Common study-away window."}
                        </p>
                      </div>

                      <span
                        className={`study-away-status ${isSelected ? "study-away-status--active" : ""}`}
                      >
                        {isSelected
                          ? location
                            ? "Site chosen"
                            : "Needs site"
                          : selectionDisabled
                            ? "Limit reached"
                            : "Not selected"}
                      </span>
                    </div>

                    <div className="study-away-location-stack">
                      <label className="study-away-location-group">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="sr-only">
                          Location for {getSemesterLabel(semesterId)}
                        </span>
                        <select
                          value={location}
                          onChange={(event) =>
                            onSetLocation(semesterId, event.target.value)
                          }
                          disabled={locationDisabled}
                          aria-label={`Study away site for ${getSemesterLabel(semesterId)}`}
                        >
                          <option value="">Select a site</option>
                          {STUDY_AWAY.locations.map((option) => {
                            const blocked = isBlockedLocation(
                              semesterId,
                              option,
                            );
                            return (
                              <option
                                key={option}
                                value={option}
                                disabled={blocked}
                              >
                                {blocked
                                  ? `${option} (Unavailable this term)`
                                  : option}
                              </option>
                            );
                          })}
                        </select>
                      </label>

                      {!isSelected && (
                        <p className="study-away-inline-note">
                          Select this semester first to choose a site.
                        </p>
                      )}

                      {isSelected && quickPicks.length > 0 && (
                        <div className="study-away-quick-picks">
                          {quickPicks.map((option) => (
                            <button
                              type="button"
                              key={option}
                              className={`study-away-quick-pick ${location === option ? "study-away-quick-pick--active" : ""}`}
                              onClick={() => onSetLocation(semesterId, option)}
                              aria-pressed={location === option}
                            >
                              {option}
                            </button>
                          ))}
                          {location && (
                            <button
                              type="button"
                              className="study-away-quick-pick"
                              onClick={() => onSetLocation(semesterId, "")}
                            >
                              Clear site
                            </button>
                          )}
                        </div>
                      )}

                      {semesterId === "Y2-Spring" && (
                        <p className="study-away-inline-note">
                          New York and Abu Dhabi are unavailable in Sophomore
                          Spring.
                        </p>
                      )}

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

            <div className="study-away-actions">
              <button
                type="button"
                className="study-away-action-btn study-away-action-btn--secondary"
                onClick={clearSelections}
                disabled={selectedCount === 0}
              >
                Clear selections
              </button>
              <button
                type="button"
                className="study-away-action-btn study-away-action-btn--primary"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </div>

          <aside className="study-away-sidebar">
            <div className="study-away-summary">
              <span className="study-away-summary-label">Selection status</span>
              <p className="study-away-summary-headline">{selectionStatus}</p>
              <p className="study-away-summary-tip">
                {selectedCount === 0
                  ? "You need at least one study-away semester."
                  : missingSiteCount > 0
                    ? "Each selected semester should have a site."
                    : "Your selected semesters are ready."}
              </p>
            </div>

            <div className="study-away-selected-strip">
              <span className="study-away-selected-title">
                Selected semesters
              </span>
              <div className="study-away-selected-pills">
                {sortedSelectedSemesters.length === 0 ? (
                  <span className="study-away-selected-empty">None yet</span>
                ) : (
                  sortedSelectedSemesters.map((semesterId) => (
                    <button
                      key={semesterId}
                      type="button"
                      className="study-away-selected-pill"
                      onClick={() => onToggleSemester(semesterId)}
                      aria-label={`Remove ${getSemesterLabel(semesterId)} from study away`}
                    >
                      <span>{getSemesterLabel(semesterId)}</span>
                      <span className="study-away-selected-pill-location">
                        {studyAway.locations[semesterId] || "Site pending"}
                      </span>
                      <X className="h-3 w-3" />
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="study-away-notes">
              <h3>Study Away Policy Notes</h3>
              <ul>
                {STUDY_AWAY.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>

              {isCsDsMajor && (
                <>
                  <h3 className="study-away-subheading">
                    CS/DS Advising Notes
                  </h3>
                  {majorNote ? <p>{majorNote}</p> : null}
                  <ul>
                    {(STUDY_AWAY.csdsAdvisingNotes || []).map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
