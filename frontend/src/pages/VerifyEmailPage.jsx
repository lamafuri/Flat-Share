import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const email = location.state?.email || '';
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-email', { email, otp });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post('/auth/resend-otp', { email, purpose: 'verify' });
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-ink-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">✉️</div>
          <h1 className="text-2xl font-semibold text-ink-100">Check your email</h1>
          <p className="text-ink-500 text-sm mt-1">We sent a 6-digit code to</p>
          <p className="text-accent text-sm font-medium">{email}</p>
        </div>

        <div className="card p-6">
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2.5 rounded-lg mb-4">{error}</div>
          )}
          {resent && (
            <div className="bg-success/10 border border-success/20 text-success text-sm px-3 py-2.5 rounded-lg mb-4">OTP resent successfully!</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Verification Code</label>
              <input
                type="text"
                className="input-field text-center text-xl tracking-widest font-mono"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full flex justify-center" disabled={loading || otp.length !== 6}>
              {loading ? <Spinner /> : 'Verify Email'}
            </button>
          </form>

          <button
            onClick={handleResend}
            disabled={resending}
            className="mt-3 w-full text-sm text-ink-400 hover:text-ink-200 transition-colors"
          >
            {resending ? 'Sending...' : "Didn't get it? Resend code"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}
