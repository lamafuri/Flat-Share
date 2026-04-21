import express from 'express';
import Report from '../models/Report.js';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import { protect } from '../middleware/auth.js';
import { adToBS } from '../utils/nepaliDate.js';

const router = express.Router();

// Core business logic (matches screenshot exactly)
const calculateReport = (flatRent, memberExpenses, memberCount) => {
  const totalExpenses = memberExpenses.reduce((sum, m) => sum + m.totalExpense, 0);
  const totalCost = flatRent + totalExpenses;
  const actualDividedCost = totalCost / memberCount;
  // Round to nearest 10 (e.g. 4047.5 → 4050)
  const optimizedDividedCost = Math.ceil(actualDividedCost / 10) * 10;

  const breakdown = memberExpenses.map(m => ({
    ...m,
    toPay: optimizedDividedCost - m.totalExpense
  }));

  return {
    totalExpenses,
    totalCost,
    actualDividedCost,
    optimizedDividedCost,
    breakdown
  };
};

// @route  POST /api/reports/group/:groupId/generate
// @desc   Generate report (admin only)
router.post('/group/:groupId/generate', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate('members.user', 'fullName email')
      .populate('admin', 'fullName email');

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    if (group.admin._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only admin can generate reports' });
    }

    const { flatRent, startDate, endDate } = req.body;

    if (flatRent === undefined || flatRent < 0) {
      return res.status(400).json({ success: false, message: 'Valid flat rent is required' });
    }

    // Build date filter
    let dateFilter = { group: group._id };
    if (startDate && endDate) {
      dateFilter.date = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59))
      };
    }

    // Get all expenses
    const expenses = await Expense.find(dateFilter)
      .populate('user', 'fullName email')
      .sort({ date: 1 });

    // Build member list (admin + all members)
    const allMembers = [
      { user: group.admin, joinedAt: group.createdAt }
    ];
    group.members.forEach(m => {
      if (m.user._id.toString() !== group.admin._id.toString()) {
        allMembers.push(m);
      }
    });

    // Build per-member expense breakdown
    const memberExpenses = allMembers.map(memberEntry => {
      const memberUser = memberEntry.user;
      const memberExpenseList = expenses.filter(
        e => e.user._id.toString() === memberUser._id.toString()
      );

      const itemsList = memberExpenseList.flatMap(exp =>
        exp.items.map(item => ({
          date: exp.date,
          nepaliDate: exp.nepaliDate?.fullDate || '',
          itemName: item.itemName,
          price: item.price
        }))
      );

      const totalExpense = memberExpenseList.reduce((sum, e) => sum + e.totalAmount, 0);

      return {
        user: memberUser._id,
        fullName: memberUser.fullName,
        totalExpense,
        items: itemsList
      };
    });

    const memberCount = allMembers.length;
    const calc = calculateReport(Number(flatRent), memberExpenses, memberCount);

    // Build nepali date strings for billing period
    let startNepaliDate = '', endNepaliDate = '', label = '';
    if (group.country === 'Nepal') {
      const actualStart = startDate ? new Date(startDate) : (expenses[0]?.date || new Date());
      const actualEnd = endDate ? new Date(endDate) : new Date();
      const bsStart = adToBS(actualStart);
      const bsEnd = adToBS(actualEnd);
      startNepaliDate = bsStart.fullDate;
      endNepaliDate = bsEnd.fullDate;
      label = `${bsStart.monthName} ${bsStart.year}`;
    } else {
      const d = new Date();
      label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    // Save report
    const report = await Report.create({
      group: group._id,
      generatedBy: req.user._id,
      flatRent: Number(flatRent),
      billingPeriod: {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        startNepaliDate,
        endNepaliDate,
        label
      },
      totalExpenses: calc.totalExpenses,
      totalCost: calc.totalCost,
      actualDividedCost: calc.actualDividedCost,
      optimizedDividedCost: calc.optimizedDividedCost,
      memberCount,
      breakdown: calc.breakdown,
      expenses: expenses.map(e => e._id)
    });

    res.status(201).json({
      success: true,
      report: {
        ...report.toObject(),
        groupName: group.name,
        country: group.country
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  GET /api/reports/group/:groupId
// @desc   Get all reports for a group
router.get('/group/:groupId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const isMember = group.members.some(m => m.user.toString() === req.user._id.toString()) ||
      group.admin.toString() === req.user._id.toString();

    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }

    const reports = await Report.find({ group: req.params.groupId })
      .populate('generatedBy', 'fullName')
      .sort({ createdAt: -1 });

    res.json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  GET /api/reports/:id
// @desc   Get a single report
router.get('/:id', protect, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('group', 'name country admin')
      .populate('generatedBy', 'fullName');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const group = await Group.findById(report.group._id);
    const isMember = group.members.some(m => m.user.toString() === req.user._id.toString()) ||
      group.admin.toString() === req.user._id.toString();

    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
