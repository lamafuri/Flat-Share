import express from 'express';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Helper: works whether group.admin is a raw ObjectId OR a populated object
const getAdminId = (group) => {
  return group.admin?._id ? group.admin._id.toString() : group.admin.toString();
};

const isMember = (group, userId) => {
  const uid = userId.toString();
  return group.members.some(m => {
    const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
    return memberId === uid;
  }) || getAdminId(group) === uid;
};

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

// IMPORTANT: /invitations/mine must be BEFORE /:id
// @route  GET /api/groups/invitations/mine
router.get('/invitations/mine', protect, async (req, res) => {
  try {
    const groups = await Group.find({
      invitations: {
        $elemMatch: { user: req.user._id, status: 'pending' }
      }
    }).populate('admin', 'fullName email');

    const invitations = groups.map(group => ({
      groupId: group._id,
      groupName: group.name,
      country: group.country,
      admin: group.admin,
      invitedAt: group.invitations.find(
        inv => inv.user.toString() === req.user._id.toString()
      )?.invitedAt
    }));

    res.json({ success: true, invitations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  GET /api/groups/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('admin', 'fullName email')
      .populate('members.user', 'fullName email')
      .populate('invitations.user', 'fullName email');

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

// @route  POST /api/groups/:id/invite
router.post('/:id/invite', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    if (group.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only admin can invite members' });
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
      return res.status(400).json({ success: false, message: 'User is already a member' });
    }

    const alreadyInvited = group.invitations.some(
      inv => inv.user?.toString() === targetUser._id.toString() && inv.status === 'pending'
    );
    if (alreadyInvited) {
      return res.status(400).json({ success: false, message: 'User already has a pending invitation' });
    }

    group.invitations.push({ user: targetUser._id, email: targetUser.email, status: 'pending' });
    await group.save();

    res.json({ success: true, message: 'Invitation sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  POST /api/groups/:id/respond-invite
router.post('/:id/respond-invite', protect, async (req, res) => {
  try {
    const { action } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const invitation = group.invitations.find(
      inv => inv.user.toString() === req.user._id.toString() && inv.status === 'pending'
    );
    if (!invitation) {
      return res.status(404).json({ success: false, message: 'No pending invitation found' });
    }

    invitation.status = action === 'accept' ? 'accepted' : 'rejected';
    if (action === 'accept') {
      group.members.push({ user: req.user._id });
    }
    await group.save();

    res.json({ success: true, message: action === 'accept' ? 'Joined the group!' : 'Invitation declined' });
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
    group.members = group.members.filter(m => m.user.toString() !== req.params.userId);
    await group.save();
    res.json({ success: true, message: 'Member removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  PUT /api/groups/:id
// @desc   Edit group name/country (admin only)
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
// @desc   Delete entire group (admin only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    if (group.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only admin can delete this group' });
    }
    // Also delete all expenses and reports for this group
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