import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useRef } from 'react';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwaPrompt, setPwaPrompt] = useState(null);
  const [showPwaBanner, setShowPwaBanner] = useState(false);
  const menuRef = useRef(null);

  // Handle PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPwaPrompt(e);
      // Show banner after 30s if not dismissed
      setTimeout(() => setShowPwaBanner(true), 30000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const handleInstall = async () => {
    if (!pwaPrompt) return;
    pwaPrompt.prompt();
    await pwaPrompt.userChoice;
    setPwaPrompt(null);
    setShowPwaBanner(false);
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-dvh min-h-screen flex flex-col bg-ink-950">
      {/* ── Top Navbar ── */}
      <header className="border-b border-ink-800 bg-ink-900/90 backdrop-blur-nav sticky top-0 z-30 pt-safe">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 touch-manipulation" aria-label="FlatShare Home">
            <span className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">F</span>
            <span className="font-semibold text-ink-100 tracking-tight hidden xs:block">FlatShare</span>
          </Link>

          {/* Desktop Nav links */}
          <nav className="hidden sm:flex items-center gap-1" role="navigation" aria-label="Main navigation">
            <NavLink to="/dashboard" active={isActive('/dashboard')}>Dashboard</NavLink>
            <NavLink to="/invitations" active={isActive('/invitations')}>Invitations</NavLink>
          </nav>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-1.5 sm:gap-2 hover:bg-ink-800 active:bg-ink-700 px-2 py-1.5 rounded-lg transition-colors touch-manipulation"
              aria-label="User menu"
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              <span className="w-7 h-7 bg-accent/20 text-accent text-xs font-bold rounded-full flex items-center justify-center shrink-0">
                {initials}
              </span>
              <span className="hidden sm:block text-sm text-ink-300 max-w-[120px] truncate">{user?.fullName}</span>
              <svg className="w-3.5 h-3.5 text-ink-500 hidden sm:block" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-48 card shadow-modal py-1 z-50 scale-in"
                role="menu"
                aria-label="User options"
              >
                {/* Mobile: show name */}
                <div className="sm:hidden px-3 py-2 border-b border-ink-800">
                  <p className="text-sm font-medium text-ink-100 truncate">{user?.fullName}</p>
                  <p className="text-xs text-ink-500 truncate">{user?.email}</p>
                </div>
                <Link
                  to="/profile"
                  className="flex items-center gap-2.5 px-3 py-2.5 sm:py-2 text-sm text-ink-300 hover:text-ink-100 hover:bg-ink-800 transition-colors touch-manipulation"
                  onClick={() => setMenuOpen(false)}
                  role="menuitem"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Profile
                </Link>
                {pwaPrompt && (
                  <button
                    onClick={() => { handleInstall(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 sm:py-2 text-sm text-accent hover:bg-accent/5 transition-colors touch-manipulation"
                    role="menuitem"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Install App
                  </button>
                )}
                <div className="border-t border-ink-800 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 sm:py-2 text-sm text-danger hover:bg-danger/5 transition-colors touch-manipulation"
                  role="menuitem"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 page-content fade-in">
        {children}
      </main>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="bottom-nav sm:hidden shadow-nav" role="navigation" aria-label="Mobile navigation">
        <div className="flex items-center justify-around h-16">
          <BottomNavLink
            to="/dashboard"
            active={isActive('/dashboard')}
            label="Dashboard"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive('/dashboard') ? 2.5 : 1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            }
          />
          <BottomNavLink
            to="/invitations"
            active={isActive('/invitations')}
            label="Invitations"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive('/invitations') ? 2.5 : 1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />
          <BottomNavLink
            to="/profile"
            active={isActive('/profile')}
            label="Profile"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive('/profile') ? 2.5 : 1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />
        </div>
      </nav>

      {/* ── PWA Install Banner ── */}
      {showPwaBanner && pwaPrompt && (
        <div className="pwa-install-banner" role="dialog" aria-label="Install FlatShare app">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0">F</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-100">Install FlatShare</p>
              <p className="text-xs text-ink-500 mt-0.5">Add to home screen for offline access</p>
              <div className="flex gap-2 mt-2.5">
                <button onClick={handleInstall} className="btn-primary text-xs px-3 py-1.5">Install</button>
                <button onClick={() => setShowPwaBanner(false)} className="btn-ghost text-xs px-3 py-1.5">Later</button>
              </div>
            </div>
            <button onClick={() => setShowPwaBanner(false)} className="text-ink-600 hover:text-ink-400 touch-manipulation p-1" aria-label="Dismiss">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
        active ? 'bg-accent/10 text-accent' : 'text-ink-400 hover:text-ink-200 hover:bg-ink-800'
      }`}
    >
      {children}
    </Link>
  );
}

function BottomNavLink({ to, active, label, icon }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-1 px-5 py-1 rounded-lg transition-colors touch-manipulation ${
        active ? 'text-accent' : 'text-ink-500 hover:text-ink-300'
      }`}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      {icon}
      <span className={`text-[10px] font-medium ${active ? 'text-accent' : 'text-ink-600'}`}>{label}</span>
    </Link>
  );
}
