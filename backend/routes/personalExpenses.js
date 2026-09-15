import express from 'express';
import mongoose from 'mongoose';
import PersonalExpense, { PERSONAL_EXPENSE_CATEGORIES } from '../models/PersonalExpense.js';
import { protect } from '../middleware/auth.js';
import { parseCalendarDay, calendarDayToDate, startOfUTCDay, endOfUTCDay } from '../utils/calendarDay.js';

const router = express.Router();

const MAX_AMOUNT = 10000000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Validates a create/update body. Returns { data } or { error }.
const validateExpense = (body = {}) => {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return { error: 'Title is required' };
  if (title.length > 100) return { error: 'Title cannot exceed 100 characters' };

  const amount = typeof body.amount === 'string' || typeof body.amount === 'number' ? Number(body.amount) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Amount must be a number greater than 0' };
  if (amount > MAX_AMOUNT) return { error: 'Amount is too large' };

  const category = body.category ?? 'other';
  if (!PERSONAL_EXPENSE_CATEGORIES.includes(category)) return { error: 'Invalid category' };

  const day = parseCalendarDay(body.date);
  if (!day) return { error: 'Date must be a valid YYYY-MM-DD date' };

  const note = body.note == null ? '' : body.note;
  if (typeof note !== 'string') return { error: 'Note must be text' };
  if (note.trim().length > 500) return { error: 'Note cannot exceed 500 characters' };

  return {
    data: {
      title,
      amount: Math.round(amount * 100) / 100,
      category,
      date: calendarDayToDate(day),
      note: note.trim()
    }
  };
};

const findOwnExpense = (id, userId) => {
  if (!mongoose.isValidObjectId(id)) return null;
  return PersonalExpense.findOne({ _id: id, user: userId });
};

// @route  GET /api/personal-expenses
// @desc   List the current user's personal expenses (newest first)
router.get('/', protect, async (req, res) => {
  try {
    const filter = { user: req.user._id };

    const { from, to, category } = req.query;
    if (from !== undefined || to !== undefined) {
      const fromDay = from !== undefined ? parseCalendarDay(from) : null;
      const toDay = to !== undefined ? parseCalendarDay(to) : null;
      if ((from !== undefined && !fromDay) || (to !== undefined && !toDay)) {
        return res.status(400).json({ success: false, message: 'from and to must be YYYY-MM-DD dates' });
      }
      filter.date = {};
      if (fromDay) filter.date.$gte = startOfUTCDay(fromDay);
      if (toDay) filter.date.$lte = endOfUTCDay(toDay);
    }

    if (category !== undefined) {
      if (!PERSONAL_EXPENSE_CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, message: 'Invalid category' });
      }
      filter.category = category;
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const [expenses, summary] = await Promise.all([
      PersonalExpense.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit),
      PersonalExpense.aggregate([
        { $match: filter },
        { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
      ])
    ]);

    res.json({
      success: true,
      expenses,
      total: summary[0]?.count ?? 0,
      totalAmount: Math.round((summary[0]?.totalAmount ?? 0) * 100) / 100
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  POST /api/personal-expenses
// @desc   Add a personal expense
router.post('/', protect, async (req, res) => {
  try {
    const { data, error } = validateExpense(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const expense = await PersonalExpense.create({ ...data, user: req.user._id });
    res.status(201).json({ success: true, expense });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  PUT /api/personal-expenses/:id
// @desc   Update a personal expense
router.put('/:id', protect, async (req, res) => {
  try {
    const expense = await findOwnExpense(req.params.id, req.user._id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    const { data, error } = validateExpense(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    expense.set(data);
    await expense.save();
    res.json({ success: true, expense });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  DELETE /api/personal-expenses/:id
// @desc   Delete a personal expense
router.delete('/:id', protect, async (req, res) => {
  try {
    const expense = await findOwnExpense(req.params.id, req.user._id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    await expense.deleteOne();
    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
