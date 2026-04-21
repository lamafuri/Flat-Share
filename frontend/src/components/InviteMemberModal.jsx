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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Invite Member</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg mb-3">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-success/10 border border-success/20 text-success text-sm px-3 py-2 rounded-lg mb-3">
            ✓ {success}
          </div>
        )}

        <div className="relative mb-3">
          <input
            type="text"
            className="input-field pr-10"
            placeholder="Search by name or enter email..."
            value={query}
            onChange={e => { setQuery(e.target.value); setError(''); setSuccess(''); }}
            autoFocus
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {results.length > 0 && (
          <div className="bg-ink-800 border border-ink-700 rounded-lg overflow-hidden mb-3">
            {results.map(user => (
              <div key={user._id} className="flex items-center justify-between px-3 py-2.5 hover:bg-ink-700 transition-colors border-b border-ink-700 last:border-0">
                <div>
                  <p className="text-sm font-medium text-ink-100">{user.fullName}</p>
                  <p className="text-xs text-ink-500">{user.email}</p>
                </div>
                {invited.has(user._id) ? (
                  <span className="text-xs text-success font-medium">✓ Invited</span>
                ) : (
                  <button onClick={() => invite(user)} className="text-xs bg-accent/10 hover:bg-accent/20 text-accent font-medium px-2.5 py-1 rounded transition-colors">
                    Invite
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {query.length >= 2 && !query.includes('@') && !searching && results.length === 0 && (
          <p className="text-xs text-ink-500 text-center mb-3 px-2">
            No users found. Try typing their full email address to invite directly.
          </p>
        )}

        {isEmail && (
          <div className="bg-ink-800 border border-ink-700 rounded-lg px-3 py-3 mb-3">
            <p className="text-sm text-ink-300 mb-2">
              Invite <span className="text-accent font-medium">{query}</span> by email
            </p>
            {invited.has(query) ? (
              <span className="text-xs text-success font-medium">✓ Invitation sent</span>
            ) : (
              <button onClick={inviteByEmail} className="btn-primary text-xs px-3 py-1.5 w-full flex justify-center">
                Send Invitation
              </button>
            )}
          </div>
        )}

        <div className="text-xs text-ink-600 mb-3 px-1">
          💡 The person must have a registered FlatShare account to receive an invitation.
        </div>

        <button onClick={onClose} className="btn-ghost w-full">Done</button>
      </div>
    </div>
  );
}
