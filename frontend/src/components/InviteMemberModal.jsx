import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';

export default function InviteMemberModal({ groupId, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [invited, setInvited] = useState(new Set());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    // Auto-focus search on desktop
    if (window.innerWidth >= 640) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.includes('@') || query.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
        setResults(data.users);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const invite = async (user) => {
    setError('');
    setSuccess('');
    try {
      await api.post(`/groups/${groupId}/invite`, { userId: user._id });
      setInvited(s => new Set([...s, user._id]));
      setSuccess(`${user.fullName} has been invited!`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to invite');
    }
  };

  const inviteByEmail = async () => {
    if (!query.includes('@')) { setError('Enter a valid email'); return; }
    setError('');
    setSuccess('');
    try {
      await api.post(`/groups/${groupId}/invite`, { email: query });
      setInvited(s => new Set([...s, query]));
      setSuccess(`Invitation sent to ${query}!`);
      setQuery('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to invite. Make sure this email is registered on FlatShare.');
    }
  };

  const isEmail = query.includes('@') && query.includes('.');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Invite member"
    >
      <div
        className="w-full sm:max-w-sm bg-ink-900 border-t sm:border border-ink-800 rounded-t-2xl sm:rounded-xl sm:mx-4 max-h-[80vh] sm:max-h-[70vh] flex flex-col slide-up sm:scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-ink-700 rounded-full" aria-hidden />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-ink-800">
          <h2 className="text-base sm:text-lg font-semibold">Invite Member</h2>
          <button onClick={onClose} className="btn-icon w-8 h-8 sm:w-9 sm:h-9 text-ink-400 touch-manipulation" aria-label="Close">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-3">
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg" role="alert">{error}</div>
          )}
          {success && (
            <div className="bg-success/10 border border-success/20 text-success text-sm px-3 py-2 rounded-lg" role="status">✓ {success}</div>
          )}

          {/* Search */}
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              className="input-field pr-10"
              placeholder="Search by name or enter email..."
              value={query}
              onChange={e => { setQuery(e.target.value); setError(''); setSuccess(''); }}
              autoComplete="off"
              aria-label="Search users"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" aria-hidden />
            )}
          </div>

          {/* Search results */}
          {results.length > 0 && (
            <div className="bg-ink-800 border border-ink-700 rounded-xl overflow-hidden" role="listbox" aria-label="Search results">
              {results.map(user => (
                <div
                  key={user._id}
                  className="flex items-center justify-between px-3 py-3 hover:bg-ink-700 transition-colors border-b border-ink-700 last:border-0"
                  role="option"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-100 truncate">{user.fullName}</p>
                    <p className="text-xs text-ink-500 truncate">{user.email}</p>
                  </div>
                  {invited.has(user._id) ? (
                    <span className="text-xs text-success font-medium ml-2 shrink-0">✓ Invited</span>
                  ) : (
                    <button
                      onClick={() => invite(user)}
                      className="btn-primary text-xs px-3 py-1.5 ml-2 shrink-0 touch-manipulation"
                      style={{ minHeight: '36px' }}
                    >
                      Invite
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* No results hint */}
          {query.length >= 2 && !query.includes('@') && !searching && results.length === 0 && (
            <p className="text-xs text-ink-500 text-center px-2">
              No users found. Try their full email address.
            </p>
          )}

          {/* Email invite */}
          {isEmail && (
            <div className="bg-ink-800 border border-ink-700 rounded-xl px-4 py-3">
              <p className="text-sm text-ink-300 mb-2">
                Invite <span className="text-accent font-medium break-all">{query}</span>
              </p>
              {invited.has(query) ? (
                <span className="text-xs text-success font-medium">✓ Invitation sent</span>
              ) : (
                <button
                  onClick={inviteByEmail}
                  className="btn-primary text-sm w-full touch-manipulation"
                >
                  Send Invitation
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-ink-600 px-1">
            💡 Person must have a FlatShare account to receive an invitation.
          </p>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-ink-800">
          <button onClick={onClose} className="btn-ghost w-full touch-manipulation">Done</button>
        </div>
      </div>
    </div>
  );
}
