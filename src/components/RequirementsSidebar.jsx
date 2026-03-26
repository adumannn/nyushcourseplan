import { useState } from 'react';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';
import { CATEGORIES, GRADUATION_CREDITS } from '../data/courses';

function ChevronIcon({ open }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
    >
      <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ReqItem({ req }) {
  const catColor = CATEGORIES[req.category]?.color || '#546E7A';
  const pct = req.coursesNeeded
    ? Math.min(100, (req.coursesTaken / req.coursesNeeded) * 100)
    : 0;

  return (
    <div className={`req-item ${req.fulfilled ? 'req-item--fulfilled' : ''}`}>
      <div className="req-item-header">
        <div className="req-item-label">
          <span className="req-dot" style={{ backgroundColor: catColor }} />
          <span>{req.label}</span>
        </div>
        {req.fulfilled ? (
          <span className="req-status req-status--done">&#10003; Complete</span>
        ) : (
          <span className="req-status">
            {req.coursesTaken}/{req.coursesNeeded} courses
          </span>
        )}
      </div>
      <div className="req-bar">
        <div
          className="req-bar-fill"
          style={{ width: `${pct}%`, backgroundColor: catColor }}
        />
      </div>
      <div className="req-credits-text">
        {req.creditsTaken} / {req.creditsNeeded} credits
      </div>
    </div>
  );
}

export default function RequirementsSidebar({ requirementProgress, totalCredits }) {
  const [collapsed, setCollapsed] = useState(false);
  const reqEntries = Object.values(requirementProgress).filter(r => r.id !== 'electives');
  const electives = requirementProgress['electives'];

  const coreReqs = reqEntries.filter(r => r.id !== 'major');
  const majorReq = reqEntries.find(r => r.id === 'major');

  const pctOverall = Math.min(100, (totalCredits / GRADUATION_CREDITS) * 100);

  return (
    <aside className={`requirements-sidebar ${collapsed ? 'requirements-sidebar--collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand requirements' : 'Collapse requirements'}
        aria-label={collapsed ? 'Expand requirements' : 'Collapse requirements'}
      >
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {collapsed ? (
        <div className="sidebar-collapsed-content">
          <span className="sidebar-collapsed-label">Req</span>
          <div className="sidebar-collapsed-ring">
            <span>{totalCredits}</span>
            <span className="sidebar-collapsed-ring-sub">/{GRADUATION_CREDITS}</span>
          </div>
        </div>
      ) : (
        <>
          <h2 className="sidebar-title">Requirements</h2>

          <div className="req-overall">
            <div className="req-overall-bar">
              <div className="req-overall-fill" style={{ width: `${pctOverall}%` }} />
            </div>
            <div className="req-overall-text">
              <span>{totalCredits} / {GRADUATION_CREDITS} credits</span>
              <span>{Math.max(0, GRADUATION_CREDITS - totalCredits)} remaining</span>
            </div>
          </div>

          <div className="req-list">
            <Disclosure defaultOpen>
              {({ open }) => (
                <>
                  <DisclosureButton className="req-section-btn">
                    <span>Core Requirements</span>
                    <ChevronIcon open={open} />
                  </DisclosureButton>
                  <DisclosurePanel className="req-section-panel">
                    {coreReqs.map(req => (
                      <ReqItem key={req.id} req={req} />
                    ))}
                  </DisclosurePanel>
                </>
              )}
            </Disclosure>

            {majorReq && (
              <Disclosure defaultOpen>
                {({ open }) => (
                  <>
                    <DisclosureButton className="req-section-btn">
                      <span>Major — {majorReq.label}</span>
                      <ChevronIcon open={open} />
                    </DisclosureButton>
                    <DisclosurePanel className="req-section-panel">
                      <ReqItem req={majorReq} />
                    </DisclosurePanel>
                  </>
                )}
              </Disclosure>
            )}

            {electives && (
              <Disclosure defaultOpen>
                {({ open }) => (
                  <>
                    <DisclosureButton className="req-section-btn">
                      <span>Electives</span>
                      <ChevronIcon open={open} />
                    </DisclosureButton>
                    <DisclosurePanel className="req-section-panel">
                      <div className="req-item">
                        <div className="req-item-header">
                          <div className="req-item-label">
                            <span className="req-dot" style={{ backgroundColor: CATEGORIES.elective.color }} />
                            <span>Free Electives</span>
                          </div>
                          <span className="req-status">
                            {electives.coursesTaken} courses
                          </span>
                        </div>
                        <div className="req-credits-text">
                          {electives.creditsTaken} credits
                        </div>
                      </div>
                    </DisclosurePanel>
                  </>
                )}
              </Disclosure>
            )}
          </div>

          <div className="sidebar-legend">
            <h3>Category Legend</h3>
            <div className="legend-items">
              {Object.entries(CATEGORIES).map(([key, cat]) => (
                <div key={key} className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: cat.color }} />
                  <span>{cat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
