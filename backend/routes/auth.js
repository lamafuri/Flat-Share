import express from 'express';
import User from '../models/User.js';
import { sendOTPEmail, generateOTP } from '../utils/email.js';
import { sendTokenResponse } from '../utils/jwt.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route  POST /api/auth/register
// @desc   Register user
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const otp = generateOTP();
    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      password,
      otp: {
        code: otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        purpose: 'verify'
      }
    });

    try {
      await sendOTPEmail(email, otp, 'verify');
    } catch (emailError) {
      console.error('Email send failed:', emailError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      userId: user._id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  POST /api/auth/verify-email
// @desc   Verify email with OTP
router.post('/verify-email', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Email already verified' });
    }

    if (!user.otp || user.otp.purpose !== 'verify') {
      return res.status(400).json({ success: false, message: 'Invalid OTP request' });
    }

    if (user.otp.code !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (new Date() > user.otp.expiresAt) {
      return res.status(400).json({ success: false, message: 'OTP has expired' });
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
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  POST /api/auth/forgot-password
// @desc   Send password reset OTP
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account with that email' });
    }

    const otp = generateOTP();
    user.otp = {
      code: otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      purpose: 'reset'
    };
    await user.save();

    await sendOTPEmail(email, otp, 'reset');

    res.json({ success: true, message: 'Password reset OTP sent to your email' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  POST /api/auth/reset-password
// @desc   Reset password with OTP
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.otp || user.otp.purpose !== 'reset') {
      return res.status(400).json({ success: false, message: 'Invalid reset request' });
    }

    if (user.otp.code !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (new Date() > user.otp.expiresAt) {
      return res.status(400).json({ success: false, message: 'OTP has expired' });
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
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, purpose } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otp = generateOTP();
    user.otp = {
      code: otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      purpose: purpose || 'verify'
    };
    await user.save();

    await sendOTPEmail(email, otp, purpose || 'verify');

    res.json({ success: true, message: 'OTP resent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  POST /api/auth/logout
// @desc   Logout user
router.post('/logout', protect, (req, res) => {
  res.cookie('token', '', { expires: new Date(0), httpOnly: true });
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
