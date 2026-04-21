import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="border-b border-ink-800 bg-ink-900/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center text-white font-bold text-sm">F</span>
            <span className="font-semibold text-ink-100 tracking-tight">FlatShare</span>
          </Link>

          {/* Nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            <NavLink to="/dashboard" active={location.pathname === '/dashboard'}>Dashboard</NavLink>
            <NavLink to="/invitations" active={location.pathname === '/invitations'}>Invitations</NavLink>
          </nav>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2 hover:bg-ink-800 px-2 py-1.5 rounded-lg transition-colors"
            >
              <span className="w-7 h-7 bg-accent/20 text-accent text-xs font-bold rounded-full flex items-center justify-center">
                {initials}
              </span>
              <span className="hidden sm:block text-sm text-ink-300 max-w-[120px] truncate">{user?.fullName}</span>
              <svg className="w-3.5 h-3.5 text-ink-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-48 card shadow-xl shadow-black/40 py-1 z-50"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <Link to="/profile" className="flex items-center gap-2.5 px-3 py-2 text-sm text-ink-300 hover:text-ink-100 hover:bg-ink-800 transition-colors" onClick={() => setMenuOpen(false)}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Profile
                </Link>
                <div className="border-t border-ink-800 my-1" />
                <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger/5 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

function NavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-accent/10 text-accent' : 'text-ink-400 hover:text-ink-200 hover:bg-ink-800'
      }`}
    >
      {children}
    </Link>
  );
}
