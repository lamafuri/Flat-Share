import express from 'express';
import Expense from '../models/Expense.js';
import PersonalExpense from '../models/PersonalExpense.js';
import { protect } from '../middleware/auth.js';
import { parseCalendarDay, startOfUTCDay, endOfUTCDay } from '../utils/calendarDay.js';

const router = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 1100;

// Group expense dates are instants (UTC midnight for a picked day, or the
// moment of entry), while the client groups spending by its local calendar
// day. Widen the query by the largest timezone offset on each side; the
// client drops entries that fall outside its local range.
const TIMEZONE_MARGIN_MS = 14 * 60 * 60 * 1000;

// @route  GET /api/insights/expenses
// @desc   The current user's spending for a date range: personal expenses plus
//         the items they bought in groups (never other members' expenses)
router.get('/expenses', protect, async (req, res) => {
  try {
    const fromDay = parseCalendarDay(req.query.from);
    const toDay = parseCalendarDay(req.query.to);
    if (!fromDay || !toDay) {
      return res.status(400).json({ success: false, message: 'from and to must be YYYY-MM-DD dates' });
    }

    const start = startOfUTCDay(fromDay);
    const end = endOfUTCDay(toDay);
    if (end < start) {
      return res.status(400).json({ success: false, message: 'from must be on or before to' });
    }
    if ((end - start) / DAY_MS > MAX_RANGE_DAYS) {
      return res.status(400).json({ success: false, message: 'Date range cannot exceed 3 years' });
    }

    const dateRange = {
      $gte: new Date(start.getTime() - TIMEZONE_MARGIN_MS),
      $lte: new Date(end.getTime() + TIMEZONE_MARGIN_MS)
    };

    const [personalExpenses, groupExpenses] = await Promise.all([
      PersonalExpense.find({ user: req.user._id, date: dateRange }).lean(),
      Expense.find({ user: req.user._id, date: dateRange }).populate('group', 'name').lean()
    ]);

    const personalEntries = personalExpenses.map(expense => ({
      id: expense._id.toString(),
      source: 'personal',
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      note: expense.note,
      date: expense.date
    }));

    // One entry per purchased item so charts and top-expense lists can show
    // what the money went on.
    const groupEntries = groupExpenses.flatMap(expense =>
      expense.items.map((item, index) => ({
        id: `${expense._id}-${index}`,
        source: 'group',
        title: item.itemName,
        amount: item.price,
        category: item.category,
        date: expense.date,
        expenseId: expense._id.toString(),
        groupId: expense.group?._id?.toString() ?? null,
        groupName: expense.group?.name ?? 'Deleted group'
      }))
    );

    const entries = [...personalEntries, ...groupEntries]
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
