import express from 'express';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @route  GET /api/users/search
// @desc   Search users by name or email
router.get('/search', protect, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (q.length < 2) {
      return res.json({ success: true, users: [] });
    }

    // Match the search text literally; raw user input must never be
    // interpreted as a regular expression.
    const pattern = escapeRegex(q);

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        { isVerified: true },
        {
          $or: [
            { fullName: { $regex: pattern, $options: 'i' } },
            { email: { $regex: pattern, $options: 'i' } }
          ]
        }
      ]
    }).select('fullName email').limit(10);

    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
