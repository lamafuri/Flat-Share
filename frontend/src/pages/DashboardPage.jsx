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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink-100">My Groups</h1>
          <p className="text-sm text-ink-500 mt-0.5">Manage your shared living expenses</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Group
        </button>
      </div>

      {/* Create group modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-4">Create Group</h2>
            {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg mb-3">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Group Name</label>
                <input type="text" className="input-field" placeholder="e.g. Kirtipur Flat" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Country</label>
                <select className="input-field" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" className="btn-ghost flex-1" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary flex-1 flex justify-center" disabled={creating}>
                  {creating ? <Spinner /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Groups list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-4xl mb-3">🏠</div>
          <p className="text-ink-300 font-medium">No groups yet</p>
          <p className="text-ink-500 text-sm mt-1">Create a group or wait for an invitation</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 inline-flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Create First Group
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
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
    <Link to={`/groups/${group._id}`} className="card p-5 hover:border-ink-700 transition-colors block group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center text-accent font-bold text-lg">
          {group.name[0].toUpperCase()}
        </div>
        {isAdmin && (
          <span className="badge bg-accent/10 text-accent border border-accent/20">Admin</span>
        )}
      </div>
      <h3 className="font-semibold text-ink-100 group-hover:text-white transition-colors">{group.name}</h3>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-xs text-ink-500 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          {memberCount} member{memberCount !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-ink-500 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>
          {group.country}
        </span>
      </div>
    </Link>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}
