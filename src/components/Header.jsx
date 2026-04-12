import { useState, useRef, useEffect } from 'react';
import { Moon, Sun, LogOut, ChevronDown } from 'lucide-react';
import { MAJORS } from '../data/courses';

export default function Header({
  major, setMajor, totalCredits,
  theme, toggleTheme,
  user, onSignOut,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || null;
  const avatarUrl = user?.user_metadata?.avatar_url || null;
  const userEmail = user?.email || null;

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="planner-header border-b border-border/40 px-4 sm:px-6 py-3 sm:py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Left — branding + major */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <h1 className="text-lg">Course Planner</h1>
          <div className="hidden sm:block h-4 w-px bg-border/60" />
          <select
            className="min-w-0 max-w-44 sm:max-w-none text-sm text-muted-foreground bg-transparent border-none outline-none cursor-pointer appearance-none pr-4"
            value={major}
            onChange={e => setMajor(e.target.value)}
            aria-label="Select major"
          >
            {MAJORS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Right — credits + theme + account */}
        <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl tabular-nums">{totalCredits}</span>
            <span className="text-sm text-muted-foreground">credits</span>
          </div>

          <div className="h-4 w-px bg-border/60" />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground cursor-pointer"
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          {/* Account */}
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 p-1 rounded-md hover:bg-accent transition-colors cursor-pointer"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="w-7 h-7 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#57068c] text-white text-xs font-medium flex items-center justify-center">
                    {(displayName || '?')[0].toUpperCase()}
                  </div>
                )}
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 sm:w-64 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-border/40">
                    <div className="flex items-center gap-3">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#57068c] text-white text-sm font-medium flex items-center justify-center">
                          {(displayName || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{displayName}</div>
                        {userEmail && (
                          <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="py-1">
                    <button
                      onClick={() => { setMenuOpen(false); onSignOut(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
