import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Globe, MapPin, PlaneTakeoff, X } from 'lucide-react';
import { MAJOR_REQUIREMENTS, SEMESTERS, STUDY_AWAY } from '../data/courses';

function getSemesterLabel(semesterId) {
  return SEMESTERS.find((semester) => semester.id === semesterId)?.label || semesterId;
}

function isBlockedLocation(semesterId, location) {
  return semesterId === 'Y2-Spring' && (location === 'New York' || location === 'Abu Dhabi');
}

function getQuickPicksForSemester(semesterId) {
  const defaultPicks = ['London', 'Paris', 'Sydney', 'New York'];
  return defaultPicks.filter((location) => STUDY_AWAY.locations.includes(location) && !isBlockedLocation(semesterId, location));
}

export default function StudyAwayPicker({
  major,
  studyAway,
  warnings,
  onClose,
  onToggleSemester,
  onSetLocation,
}) {
  const selectedCount = studyAway.selectedSemesters.length;
  const selectedRatio = Math.min((selectedCount / STUDY_AWAY.maxSemesters) * 100, 100);
  const isCsDsMajor = major === 'cs' || major === 'ds';
  const majorNote = MAJOR_REQUIREMENTS[major]?.studyAwayNotes;

  const clearSelections = () => {
    studyAway.selectedSemesters.forEach((semesterId) => onToggleSemester(semesterId));
  };

  const selectedSummary = useMemo(() => {
    if (studyAway.selectedSemesters.length === 0) {
      return 'No semesters selected yet.';
    }

    return studyAway.selectedSemesters
      .map((semesterId) => `${getSemesterLabel(semesterId)} - ${studyAway.locations[semesterId] || 'Site pending'}`)
      .join(' • ');
  }, [studyAway.locations, studyAway.selectedSemesters]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal study-away-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Study Away Option Picker</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close study away picker">
            ×
          </button>
        </div>

        <div className="study-away-intro">
          <div className="study-away-intro-icon">
            <PlaneTakeoff className="h-4 w-4" />
          </div>
          <div className="study-away-intro-content">
            <p className="study-away-intro-title">Pick up to {STUDY_AWAY.maxSemesters} recommended study-away semesters</p>
            <p className="study-away-intro-subtitle">Window: Sophomore Spring to Senior Fall • Selected: {selectedCount} semester{selectedCount === 1 ? '' : 's'}</p>
            <div className="study-away-progress" role="img" aria-label={`${selectedCount} out of ${STUDY_AWAY.maxSemesters} recommended semesters selected`}>
              <div className="study-away-progress-bar">
                <span style={{ width: `${selectedRatio}%` }} />
              </div>
              <span className="study-away-progress-label">{selectedCount}/{STUDY_AWAY.maxSemesters} recommended</span>
            </div>
          </div>
        </div>

        <div className="study-away-selected-strip">
          <span className="study-away-selected-title">Selected semesters</span>
          <div className="study-away-selected-pills">
            {studyAway.selectedSemesters.length === 0 ? (
              <span className="study-away-selected-empty">None yet</span>
            ) : (
              studyAway.selectedSemesters.map((semesterId) => (
                <button
                  key={semesterId}
                  type="button"
                  className="study-away-selected-pill"
                  onClick={() => onToggleSemester(semesterId)}
                >
                  {getSemesterLabel(semesterId)}
                  <X className="h-3 w-3" />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="study-away-semester-list scrollbar-hidden">
          {STUDY_AWAY.eligibleSemesters.map((semesterId) => {
            const isSelected = studyAway.selectedSemesters.includes(semesterId);
            const location = studyAway.locations[semesterId] || '';
            const quickPicks = getQuickPicksForSemester(semesterId);

            return (
              <div
                key={semesterId}
                className={`study-away-semester-row ${isSelected ? 'study-away-semester-row--active' : ''}`}
              >
                <div className="study-away-semester-main">
                  <button
                    type="button"
                    className="study-away-semester-toggle"
                    onClick={() => onToggleSemester(semesterId)}
                  >
                    <span className="study-away-semester-check">
                      {isSelected ? <CheckCircle2 className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    </span>
                    <span className="study-away-semester-label">{getSemesterLabel(semesterId)}</span>
                  </button>
                  <span className={`study-away-status ${isSelected ? 'study-away-status--active' : ''}`}>
                    {isSelected ? 'Selected' : 'Not selected'}
                  </span>
                </div>

                <div className="study-away-location-stack">
                  <label className="study-away-location-group">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="sr-only">Location for {getSemesterLabel(semesterId)}</span>
                    <select
                      value={location}
                      onChange={(event) => onSetLocation(semesterId, event.target.value)}
                    >
                      <option value="">Select a site</option>
                      {STUDY_AWAY.locations.map((option) => {
                        const blocked = isBlockedLocation(semesterId, option);
                        return (
                          <option
                            key={option}
                            value={option}
                            disabled={blocked}
                          >
                            {blocked ? `${option} (Unavailable this term)` : option}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  {isSelected && quickPicks.length > 0 && (
                    <div className="study-away-quick-picks">
                      {quickPicks.map((option) => (
                        <button
                          type="button"
                          key={option}
                          className={`study-away-quick-pick ${location === option ? 'study-away-quick-pick--active' : ''}`}
                          onClick={() => onSetLocation(semesterId, option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}

                  {semesterId === 'Y2-Spring' && (
                    <p className="study-away-inline-note">New York and Abu Dhabi are unavailable in Sophomore Spring.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="study-away-summary">
          <span className="study-away-summary-label">Current Plan</span>
          <p>{selectedSummary}</p>
          <p className="study-away-summary-tip">Tip: choosing a site auto-enables that semester.</p>
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

        {warnings.length > 0 && (
          <div className="study-away-warnings">
            {warnings.map((warning) => (
              <div className="study-away-warning-item" key={warning.id}>
                <AlertTriangle className="h-4 w-4" />
                <span>{warning.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="study-away-notes scrollbar-hidden">
          <h3>Study Away Policy Notes</h3>
          <ul>
            {STUDY_AWAY.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>

          {isCsDsMajor && (
            <>
              <h3 className="study-away-subheading">CS/DS Advising Notes</h3>
              {majorNote ? <p>{majorNote}</p> : null}
              <ul>
                {(STUDY_AWAY.csdsAdvisingNotes || []).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}