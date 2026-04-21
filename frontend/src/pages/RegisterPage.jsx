import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', {
        fullName: form.fullName,
        email: form.email,
        password: form.password
      });
      navigate('/verify-email', { state: { email: form.email } });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-ink-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">F</div>
          <h1 className="text-2xl font-semibold text-ink-100">Create account</h1>
          <p className="text-ink-500 text-sm mt-1">Join FlatShare today</p>
        </div>

        <div className="card p-6">
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2.5 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="Your full name"
                value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Min 6 characters"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Repeat password"
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full flex justify-center" disabled={loading}>
              {loading ? <Spinner /> : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-ink-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:text-accent-light font-medium">Sign In</Link>
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}
