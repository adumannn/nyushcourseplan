import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Globe, MapPin, PlaneTakeoff } from 'lucide-react';
import { MAJOR_REQUIREMENTS, SEMESTERS, STUDY_AWAY } from '../data/courses';

function getSemesterLabel(semesterId) {
  return SEMESTERS.find((semester) => semester.id === semesterId)?.label || semesterId;
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
  const isCsDsMajor = major === 'cs' || major === 'ds';
  const majorNote = MAJOR_REQUIREMENTS[major]?.studyAwayNotes;

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
          <div>
            <p className="study-away-intro-title">Pick up to {STUDY_AWAY.maxSemesters} recommended study-away semesters</p>
            <p className="study-away-intro-subtitle">Window: Sophomore Spring to Senior Fall • Selected: {selectedCount} semester{selectedCount === 1 ? '' : 's'}</p>
          </div>
        </div>

        <div className="study-away-semester-list scrollbar-hidden">
          {STUDY_AWAY.eligibleSemesters.map((semesterId) => {
            const isSelected = studyAway.selectedSemesters.includes(semesterId);
            const location = studyAway.locations[semesterId] || '';

            return (
              <div
                key={semesterId}
                className={`study-away-semester-row ${isSelected ? 'study-away-semester-row--active' : ''}`}
              >
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

                <label className="study-away-location-group">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="sr-only">Location for {getSemesterLabel(semesterId)}</span>
                  <select
                    value={location}
                    onChange={(event) => onSetLocation(semesterId, event.target.value)}
                  >
                    <option value="">Select a site</option>
                    {STUDY_AWAY.locations.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
            );
          })}
        </div>

        <div className="study-away-summary">
          <span className="study-away-summary-label">Current Plan</span>
          <p>{selectedSummary}</p>
          <p className="study-away-summary-tip">Tip: choosing a site auto-enables that semester.</p>
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