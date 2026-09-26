import mongoose from 'mongoose';

// Keys match GROUP_CATEGORIES in the frontend item catalog.
export const GROUP_ITEM_CATEGORIES = [
  'drinks',
  'dairy',
  'vegetables',
  'fruits',
  'essentials',
  'instant',
  'household',
  'cleaning',
  'other'
];

const expenseItemSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  // Items saved before categories existed have none; the client infers one
  // from the item name.
  category: {
    type: String,
    enum: GROUP_ITEM_CATEGORIES
  }
});

const expenseSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [expenseItemSchema],
  date: {
    type: Date,
    default: Date.now
  },
  nepaliDate: {
    year: Number,
    month: Number,
    day: Number,
    monthName: String,
    fullDate: String
  },
  totalAmount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Calculate total before save
expenseSchema.pre('save', function(next) {
  this.totalAmount = this.items.reduce((sum, item) => sum + item.price, 0);
  next();
});

// Per-user spending lookups (expense insights)
expenseSchema.index({ user: 1, date: -1 });

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
