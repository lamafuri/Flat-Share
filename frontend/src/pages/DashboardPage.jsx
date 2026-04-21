import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const COUNTRIES = ['Nepal', 'India', 'Other'];

export default function DashboardPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', country: 'Nepal' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (showCreate) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [showCreate]);

  const fetchGroups = async () => {
    try {
      const { data } = await api.get('/groups');
      setGroups(data.groups);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const { data } = await api.post('/groups', form);
      setGroups(g => [data.group, ...g]);
      setShowCreate(false);
      setForm({ name: '', country: 'Nepal' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-ink-100">My Groups</h1>
          <p className="text-xs sm:text-sm text-ink-500 mt-0.5 hidden xs:block">Manage your shared living expenses</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-1 sm:gap-1.5"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden xs:inline">New Group</span>
          <span className="xs:hidden">New</span>
        </button>
      </div>

      {/* Create group modal — bottom sheet on mobile */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
          role="dialog"
          aria-modal="true"
          aria-label="Create group"
        >
          <div
            className="w-full sm:max-w-sm bg-ink-900 border-t sm:border border-ink-800 rounded-t-2xl sm:rounded-xl sm:mx-4 slide-up sm:scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-ink-700 rounded-full" aria-hidden />
            </div>
            <div className="px-4 sm:px-6 pt-3 sm:pt-6 pb-6">
              <h2 className="text-base sm:text-lg font-semibold mb-4">Create Group</h2>
              {error && (
                <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg mb-3" role="alert">{error}</div>
              )}
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="label" htmlFor="group-name">Group Name</label>
                  <input
                    id="group-name"
                    type="text"
                    className="input-field"
                    placeholder="e.g. Kirtipur Flat"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label" htmlFor="group-country">Country</label>
                  <select
                    id="group-country"
                    className="input-field"
                    value={form.country}
                    onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  >
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" className="btn-ghost flex-1" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="btn-primary flex-1" disabled={creating}>
                    {creating ? <Spinner /> : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Groups list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" aria-label="Loading" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 sm:py-16 card fade-in">
          <div className="text-4xl mb-3" aria-hidden>🏠</div>
          <p className="text-ink-300 font-medium text-sm sm:text-base">No groups yet</p>
          <p className="text-ink-500 text-xs sm:text-sm mt-1">Create a group or wait for an invitation</p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary mt-4 inline-flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create First Group
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 fade-in">
          {groups.map(group => (
            <GroupCard key={group._id} group={group} userId={user._id} />
          ))}
        </div>
      )}
    </Layout>
  );
}

function GroupCard({ group, userId }) {
  const isAdmin = group.admin._id === userId || group.admin === userId;
  const memberCount = group.members.length;

  return (
    <Link
      to={`/groups/${group._id}`}
      className="card p-4 sm:p-5 hover:border-ink-700 active:bg-ink-800 transition-colors block group touch-manipulation"
    >
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-accent/10 rounded-lg flex items-center justify-center text-accent font-bold text-base sm:text-lg shrink-0">
          {group.name[0].toUpperCase()}
        </div>
        {isAdmin && (
          <span className="badge bg-accent/10 text-accent border border-accent/20 text-xs">Admin</span>
        )}
      </div>
      <h3 className="font-semibold text-ink-100 group-hover:text-white transition-colors text-sm sm:text-base truncate">
        {group.name}
      </h3>
      <div className="flex items-center gap-3 mt-1.5 sm:mt-2">
        <span className="text-xs text-ink-500 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {memberCount} member{memberCount !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-ink-600">·</span>
        <span className="text-xs text-ink-500 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
          </svg>
          {group.country}
        </span>
      </div>
    </Link>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" aria-hidden />;
}
