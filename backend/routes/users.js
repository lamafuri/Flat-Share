import express from 'express';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route  GET /api/users/search
// @desc   Search users by name or email
router.get('/search', protect, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success: true, users: [] });
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        { isVerified: true },
        {
          $or: [
            { fullName: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } }
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
