import mongoose from 'mongoose';

// Keys match CATEGORIES in frontend/src/utils/expenses.js.
export const PERSONAL_EXPENSE_CATEGORIES = [
  'food',
  'drinks',
  'transport',
  'health',
  'clothes',
  'social',
  'tech',
  'groceries',
  'bills',
  'shopping',
  'education',
  'entertainment',
  'other'
];

const personalExpenseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  category: {
    type: String,
    enum: PERSONAL_EXPENSE_CATEGORIES,
    default: 'other'
  },
  // Calendar day of the expense, stored at 12:00 UTC so it falls on the same
  // day in every timezone from UTC-11 to UTC+11:45.
  date: {
    type: Date,
    required: true
  },
  note: {
    type: String,
    trim: true,
    maxlength: [500, 'Note cannot exceed 500 characters'],
    default: ''
  }
}, { timestamps: true });

personalExpenseSchema.index({ user: 1, date: -1 });

const PersonalExpense = mongoose.model('PersonalExpense', personalExpenseSchema);
export default PersonalExpense;
