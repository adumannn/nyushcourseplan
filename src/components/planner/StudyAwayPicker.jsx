import { useEffect, useMemo, useRef } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Info,
  ListChecks,
  MapPinned,
  PlaneTakeoff,
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

function getSemesterHint(semesterId) {
  if (semesterId === "Y2-Spring") {
    return "Earliest eligible study-away term.";
  }

  if (semesterId === "Y4-Fall") {
    return "Final eligible term before senior spring in Shanghai.";
  }

  return "Common study-away window.";
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
  const readyCount = selectedCount - missingSiteCount;
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
            <div className="study-away-overview" aria-label="Study away status">
              <div
                className={`study-away-stat-card ${selectedCount > 0 ? "study-away-stat-card--success" : ""}`}
              >
                <div className="study-away-stat-icon">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <span className="study-away-stat-label">Semesters</span>
                <strong className="study-away-stat-value">
                  {selectedCount}/{STUDY_AWAY.maxSemesters}
                </strong>
                <span className="study-away-stat-meta">1 required</span>
              </div>

              <div
                className={`study-away-stat-card ${
                  missingSiteCount > 0
                    ? "study-away-stat-card--warning"
                    : selectedCount > 0
                      ? "study-away-stat-card--success"
                      : ""
                }`}
              >
                <div className="study-away-stat-icon">
                  <MapPinned className="h-4 w-4" />
                </div>
                <span className="study-away-stat-label">Sites ready</span>
                <strong className="study-away-stat-value">{readyCount}</strong>
                <span className="study-away-stat-meta">
                  {missingSiteCount === 0
                    ? "No gaps"
                    : `${missingSiteCount} pending`}
                </span>
              </div>

              <div
                className={`study-away-stat-card ${
                  issueCount > 0
                    ? "study-away-stat-card--warning"
                    : selectedCount > 0
                      ? "study-away-stat-card--success"
                      : ""
                }`}
              >
                <div className="study-away-stat-icon">
                  <ListChecks className="h-4 w-4" />
                </div>
                <span className="study-away-stat-label">Issues</span>
                <strong className="study-away-stat-value">{issueCount}</strong>
                <span className="study-away-stat-meta">
                  {issueCount === 0 ? "Clear" : "Needs review"}
                </span>
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
                const quickPicks = getQuickPicksForSemester(semesterId);
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
                          ? location
                            ? "Site chosen"
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

                          {quickPicks.length > 0 && (
                            <div
                              className="study-away-quick-picks"
                              aria-label={`Quick site choices for ${getSemesterLabel(semesterId)}`}
                            >
                              <span className="study-away-quick-picks-label">
                                Quick picks
                              </span>
                              {quickPicks.map((option) => (
                                <button
                                  type="button"
                                  key={option}
                                  className={`study-away-quick-pick ${location === option ? "study-away-quick-pick--active" : ""}`}
                                  onClick={() =>
                                    onSetLocation(semesterId, option)
                                  }
                                  aria-pressed={location === option}
                                >
                                  {option}
                                </button>
                              ))}
                              {location && (
                                <button
                                  type="button"
                                  className="study-away-quick-pick"
                                  onClick={() =>
                                    onSetLocation(semesterId, "")
                                  }
                                >
                                  Clear site
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="study-away-inline-note study-away-inline-note--locked">
                          <Info className="h-3.5 w-3.5" />
                          Select this semester first to choose a site.
                        </p>
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
                <RotateCcw className="h-4 w-4" />
                Clear selections
              </button>
              <button
                type="button"
                className="study-away-action-btn study-away-action-btn--primary"
                onClick={onClose}
              >
                <CheckCircle2 className="h-4 w-4" />
                Done
              </button>
            </div>
          </div>

          <aside className="study-away-sidebar">
            <div className="study-away-summary">
              <span className="study-away-summary-label">Selection status</span>
              <p className="study-away-summary-headline">{selectionStatus}</p>
              <p className="study-away-summary-tip">{nextStep}</p>
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
              <div className="study-away-notes-heading">
                <Info className="h-3.5 w-3.5" />
                <h3>Policy notes</h3>
              </div>
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
