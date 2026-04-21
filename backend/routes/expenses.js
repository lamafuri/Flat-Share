import express from 'express';
import Expense from '../models/Expense.js';
import Group from '../models/Group.js';
import { protect } from '../middleware/auth.js';
import { adToBS } from '../utils/nepaliDate.js';

const router = express.Router();

const isMember = (group, userId) => {
  return group.members.some(m => m.user.toString() === userId.toString()) ||
    group.admin.toString() === userId.toString();
};

// @route  POST /api/expenses/group/:groupId
// @desc   Add expenses for a group
router.post('/group/:groupId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    if (!isMember(group, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }

    const { items, date } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    const expenseDate = date ? new Date(date) : new Date();
    let nepaliDate = null;

    if (group.country === 'Nepal') {
      nepaliDate = adToBS(expenseDate);
    }

    const expense = await Expense.create({
      group: group._id,
      user: req.user._id,
      items,
      date: expenseDate,
      nepaliDate
    });

    const populated = await Expense.findById(expense._id).populate('user', 'fullName email');

    res.status(201).json({ success: true, expense: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  GET /api/expenses/group/:groupId
// @desc   Get all expenses for a group
router.get('/group/:groupId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    if (!isMember(group, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }

    const expenses = await Expense.find({ group: req.params.groupId })
      .populate('user', 'fullName email')
      .sort({ date: -1 });

    res.json({ success: true, expenses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  GET /api/expenses/group/:groupId/mine
// @desc   Get current user's expenses in a group
router.get('/group/:groupId/mine', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    if (!isMember(group, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }

    const expenses = await Expense.find({
      group: req.params.groupId,
      user: req.user._id
    }).populate('user', 'fullName email').sort({ date: -1 });

    res.json({ success: true, expenses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  DELETE /api/expenses/:id
// @desc   Delete an expense
router.delete('/:id', protect, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    if (expense.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this expense' });
    }

    await expense.deleteOne();
    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
