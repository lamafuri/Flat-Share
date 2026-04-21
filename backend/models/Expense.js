import mongoose from 'mongoose';

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

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
