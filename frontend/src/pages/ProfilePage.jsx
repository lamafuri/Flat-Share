import { useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      const { data } = await api.put('/auth/profile', { fullName });
      updateUser(data.user);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <Layout>
      <div className="max-w-md fade-in">
        <h1 className="text-lg sm:text-xl font-semibold text-ink-100 mb-4 sm:mb-6">Profile</h1>

        <div className="card p-4 sm:p-6">
          {/* Avatar */}
          <div className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-6 pb-5 sm:pb-6 border-b border-ink-800">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-accent/20 text-accent rounded-full flex items-center justify-center text-lg sm:text-xl font-bold shrink-0" aria-label={`Avatar: ${initials}`}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-ink-100 truncate text-sm sm:text-base">{user?.fullName}</p>
              <p className="text-xs sm:text-sm text-ink-500 truncate">{user?.email}</p>
              {user?.isVerified && (
                <span className="badge bg-success/10 text-success border border-success/20 mt-1 text-xs">✓ Verified</span>
              )}
            </div>
          </div>

          {success && (
            <div className="bg-success/10 border border-success/20 text-success text-sm px-3 py-2 rounded-lg mb-4" role="status">
              Profile updated!
            </div>
          )}
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg mb-4" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="label" htmlFor="full-name">Full Name</label>
              <input
                id="full-name"
                type="text"
                className="input-field"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input-field opacity-50 cursor-not-allowed"
                value={user?.email}
                disabled
                aria-readonly="true"
              />
              <p className="text-xs text-ink-600 mt-1">Email cannot be changed</p>
            </div>
            <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
              {saving ? <Spinner /> : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" aria-hidden />;
}
