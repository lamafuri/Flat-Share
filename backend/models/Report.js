import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  flatRent: {
    type: Number,
    required: [true, 'Flat rent is required'],
    min: [0, 'Flat rent cannot be negative']
  },
  billingPeriod: {
    startDate: Date,
    endDate: Date,
    startNepaliDate: String,
    endNepaliDate: String,
    label: String
  },
  totalExpenses: Number,
  totalCost: Number,
  actualDividedCost: Number,
  optimizedDividedCost: Number,
  memberCount: Number,
  breakdown: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fullName: String,
    totalExpense: Number,
    toPay: Number,
    items: [{
      date: Date,
      nepaliDate: String,
      itemName: String,
      price: Number
    }]
  }],
  expenses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Expense' }]
}, { timestamps: true });

const Report = mongoose.model('Report', reportSchema);
export default Report;
