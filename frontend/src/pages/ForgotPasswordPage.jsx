import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';

const STEP = { EMAIL: 1, OTP: 2, PASSWORD: 3, DONE: 4 };

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEP.EMAIL);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setStep(STEP.OTP);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const verifyOTP = (e) => {
    e.preventDefault();
    if (otp.length !== 6) { setError('Enter 6-digit OTP'); return; }
    setError('');
    setStep(STEP.PASSWORD);
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) { setError('Passwords do not match'); return; }
    if (newPassword.length < 6) { setError('Min 6 characters'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword });
      setStep(STEP.DONE);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-ink-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-warning/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">🔑</div>
          <h1 className="text-2xl font-semibold text-ink-100">
            {step === STEP.EMAIL ? 'Reset Password' :
             step === STEP.OTP ? 'Enter Code' :
             step === STEP.PASSWORD ? 'New Password' : 'All Done!'}
          </h1>
        </div>

        <div className="card p-6">
          {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2.5 rounded-lg mb-4">{error}</div>}

          {step === STEP.EMAIL && (
            <form onSubmit={sendOTP} className="space-y-4">
              <div>
                <label className="label">Your Email</label>
                <input type="email" className="input-field" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <button className="btn-primary w-full flex justify-center" disabled={loading}>
                {loading ? <Spinner /> : 'Send OTP'}
              </button>
            </form>
          )}

          {step === STEP.OTP && (
            <form onSubmit={verifyOTP} className="space-y-4">
              <p className="text-sm text-ink-400">Code sent to <span className="text-accent">{email}</span></p>
              <div>
                <label className="label">6-Digit Code</label>
                <input type="text" className="input-field text-center text-xl tracking-widest font-mono" placeholder="000000" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} required />
              </div>
              <button className="btn-primary w-full">Continue</button>
            </form>
          )}

          {step === STEP.PASSWORD && (
            <form onSubmit={resetPassword} className="space-y-4">
              <div>
                <label className="label">New Password</label>
                <input type="password" className="input-field" placeholder="Min 6 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
              </div>
              <div>
                <label className="label">Confirm Password</label>
                <input type="password" className="input-field" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </div>
              <button className="btn-primary w-full flex justify-center" disabled={loading}>
                {loading ? <Spinner /> : 'Reset Password'}
              </button>
            </form>
          )}

          {step === STEP.DONE && (
            <div className="text-center space-y-4">
              <div className="text-4xl">✅</div>
              <p className="text-ink-300">Your password has been reset.</p>
              <button onClick={() => navigate('/login')} className="btn-primary w-full">Go to Login</button>
            </div>
          )}
        </div>

        <p className="text-center mt-4">
          <Link to="/login" className="text-sm text-ink-500 hover:text-ink-300">← Back to Login</Link>
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}
