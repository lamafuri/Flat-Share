import express from 'express';
import User from '../models/User.js';
import { sendOTPEmail, generateOTP } from '../utils/email.js';
import { sendTokenResponse, authCookieOptions } from '../utils/jwt.js';
import { protect } from '../middleware/auth.js';
import { authLimiter, emailLimiter, emailBurstLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

const MAX_OTP_ATTEMPTS = 5;

const EMAIL_DELIVERY_FAILED = {
  success: false,
  code: 'EMAIL_DELIVERY_FAILED',
  message: 'We could not send the email right now. Please try again in a few minutes.'
};

// Sends the OTP email and reports whether it was handed to the provider.
// Provider errors are logged for diagnosis but never returned to clients.
const deliverOTPEmail = async (email, otp, purpose) => {
  try {
    await sendOTPEmail(email, otp, purpose);
    return true;
  } catch (error) {
    console.error(`Failed to send ${purpose} OTP email:`, error.message);
    return false;
  }
};

const normalizeEmail = (email) =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';

// Checks a submitted OTP against the one stored for the user. Every attempt
// is counted atomically before comparing, and the code is discarded once
// MAX_OTP_ATTEMPTS is reached, so a 6-digit code cannot be brute-forced.
// Returns null when the OTP is valid, otherwise an error payload.
const checkOTP = async (user, otp, purpose) => {
  if (!user.otp?.code || user.otp.purpose !== purpose) {
    return { code: 'OTP_NOT_FOUND', message: 'No active code. Please request a new one.' };
  }

  if (new Date() > user.otp.expiresAt) {
    return { code: 'OTP_EXPIRED', message: 'OTP has expired. Please request a new one.' };
  }

  const updated = await User.findOneAndUpdate(
    { _id: user._id, 'otp.purpose': purpose, 'otp.attempts': { $not: { $gte: MAX_OTP_ATTEMPTS } } },
    { $inc: { 'otp.attempts': 1 } },
    { new: true }
  );

  if (!updated) {
    return { code: 'OTP_LOCKED', message: 'Too many incorrect attempts. Please request a new code.' };
  }

  if (updated.otp.code !== String(otp)) {
    if (updated.otp.attempts >= MAX_OTP_ATTEMPTS) {
      await User.updateOne({ _id: user._id }, { $unset: { otp: 1 } });
      return { code: 'OTP_LOCKED', message: 'Too many incorrect attempts. Please request a new code.' };
    }
    return { code: 'OTP_INVALID', message: 'Invalid OTP' };
  }

  return null;
};

// @route  POST /api/auth/register
// @desc   Register user
router.post('/register', emailBurstLimiter, emailLimiter, async (req, res) => {
  try {
    const { fullName, password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser?.isVerified) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const otp = generateOTP();
    const otpData = {
      code: otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      purpose: 'verify'
    };

    // An unverified account never proved ownership of the email (for example
    // the first code was never delivered), so let registration start over
    // instead of leaving the address permanently stuck.
    let user;
    if (existingUser) {
      existingUser.fullName = fullName;
      existingUser.password = password;
      existingUser.otp = otpData;
      user = await existingUser.save();
    } else {
      user = await User.create({ fullName, email, password, otp: otpData });
    }

    // The account is kept even if the email fails, so the user can request
    // a new code from the verification page instead of registering again.
    const emailSent = await deliverOTPEmail(email, otp, 'verify');

    res.status(201).json({
      success: true,
      emailSent,
      message: emailSent
        ? 'Registration successful. Please check your email for the verification code.'
        : 'Account created, but we could not send the verification email. Please request a new code.',
      userId: user._id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  POST /api/auth/verify-email
// @desc   Verify email with OTP
router.post('/verify-email', authLimiter, async (req, res) => {
  try {
    const { otp } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Email already verified' });
    }

    const otpError = await checkOTP(user, otp, 'verify');
    if (otpError) {
      return res.status(400).json({ success: false, ...otpError });
    }

    user.isVerified = true;
    user.otp = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  POST /api/auth/login
// @desc   Login user
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email first' });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  POST /api/auth/forgot-password
// @desc   Send password reset OTP
router.post('/forgot-password', emailBurstLimiter, emailLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Respond identically whether or not the account exists so this endpoint
    // cannot be used to discover which emails are registered.
    const user = await User.findOne({ email });
    if (user) {
      const otp = generateOTP();
      user.otp = {
        code: otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        purpose: 'reset'
      };
      await user.save();

      if (!(await deliverOTPEmail(email, otp, 'reset'))) {
        return res.status(503).json(EMAIL_DELIVERY_FAILED);
      }
    }

    res.json({ success: true, message: 'If an account exists for that email, a reset code has been sent.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  POST /api/auth/reset-password
// @desc   Reset password with OTP
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { otp, newPassword } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP and new password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, code: 'OTP_NOT_FOUND', message: 'No active code. Please request a new one.' });
    }

    const otpError = await checkOTP(user, otp, 'reset');
    if (otpError) {
      return res.status(400).json({ success: false, ...otpError });
    }

    user.password = newPassword;
    user.otp = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful. Please log in.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  POST /api/auth/resend-otp
// @desc   Resend OTP
router.post('/resend-otp', emailBurstLimiter, emailLimiter, async (req, res) => {
  try {
    const purpose = req.body.purpose || 'verify';
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    if (!['verify', 'reset'].includes(purpose)) {
      return res.status(400).json({ success: false, message: 'Invalid purpose' });
    }

    // Only send when there is something to do (an existing account, and for
    // verification an unverified one), but always give the same response so
    // account existence and verification status are not disclosed.
    const user = await User.findOne({ email });
    if (user && !(purpose === 'verify' && user.isVerified)) {
      const otp = generateOTP();
      user.otp = {
        code: otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        purpose
      };
      await user.save();

      if (!(await deliverOTPEmail(email, otp, purpose))) {
        return res.status(503).json(EMAIL_DELIVERY_FAILED);
      }
    }

    res.json({ success: true, message: 'If this email needs a code, a new one has been sent.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  POST /api/auth/logout
// @desc   Logout user
router.post('/logout', protect, (req, res) => {
  // Browsers only remove a cookie when the attributes match the ones it was set with.
  res.clearCookie('token', authCookieOptions());
  res.json({ success: true, message: 'Logged out successfully' });
});

// @route  GET /api/auth/me
// @desc   Get current user
router.get('/me', protect, (req, res) => {
  res.json({ success: true, user: req.user });
});

// @route  PUT /api/auth/profile
// @desc   Update profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { fullName } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { fullName },
      { new: true, runValidators: true }
    );
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
