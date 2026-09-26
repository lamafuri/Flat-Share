import express from 'express';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { getAdminId, isMember } from '../utils/groupAccess.js';

const router = express.Router();

// @route  GET /api/groups
router.get('/', protect, async (req, res) => {
  try {
    const groups = await Group.find({
      $or: [
        { admin: req.user._id },
        { 'members.user': req.user._id }
      ]
    })
    .populate('admin', 'fullName email')
    .populate('members.user', 'fullName email')
    .sort({ createdAt: -1 });

    res.json({ success: true, groups });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  POST /api/groups
router.post('/', protect, async (req, res) => {
  try {
    const { name, country } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }
    const group = await Group.create({
      name,
      country: country || 'Nepal',
      admin: req.user._id,
      members: [{ user: req.user._id }]
    });
    const populated = await Group.findById(group._id)
      .populate('admin', 'fullName email')
      .populate('members.user', 'fullName email');
    res.status(201).json({ success: true, group: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  GET /api/groups/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('admin', 'fullName email')
      .populate('members.user', 'fullName email');

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    if (!isMember(group, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }

    res.json({ success: true, group });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  POST /api/groups/:id/add-member
// @desc   Admin directly adds a user to the group
router.post('/:id/add-member', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    if (group.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only admin can add members' });
    }

    const { email, userId } = req.body;
    let targetUser;
    if (userId) {
      targetUser = await User.findById(userId);
    } else if (email) {
      targetUser = await User.findOne({ email: email.toLowerCase() });
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found. Make sure they have a registered FlatShare account.' });
    }

    if (isMember(group, targetUser._id)) {
      return res.status(400).json({ success: false, message: 'User is already a member of this group' });
    }

    group.members.push({ user: targetUser._id });
    await group.save();

    const populated = await Group.findById(group._id)
      .populate('admin', 'fullName email')
      .populate('members.user', 'fullName email');

    res.json({ success: true, message: `${targetUser.fullName} added to the group`, group: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  DELETE /api/groups/:id/members/:userId
router.delete('/:id/members/:userId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    if (group.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only admin can remove members' });
    }
    if (req.params.userId === getAdminId(group)) {
      return res.status(400).json({ success: false, message: 'Cannot remove the group admin' });
    }
    group.members = group.members.filter(m => m.user.toString() !== req.params.userId);
    await group.save();

    const populated = await Group.findById(group._id)
      .populate('admin', 'fullName email')
      .populate('members.user', 'fullName email');

    res.json({ success: true, message: 'Member removed', group: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  PUT /api/groups/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    if (group.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only admin can edit this group' });
    }
    const { name, country } = req.body;
    if (name) group.name = name.trim();
    if (country) group.country = country;
    await group.save();
    const populated = await Group.findById(group._id)
      .populate('admin', 'fullName email')
      .populate('members.user', 'fullName email');
    res.json({ success: true, group: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  DELETE /api/groups/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    if (group.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only admin can delete this group' });
    }
    const { default: Expense } = await import('../models/Expense.js');
    const { default: Report } = await import('../models/Report.js');
    await Expense.deleteMany({ group: group._id });
    await Report.deleteMany({ group: group._id });
    await group.deleteOne();
    res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;