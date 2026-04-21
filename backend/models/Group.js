import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    maxlength: [100, 'Group name cannot exceed 100 characters']
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    enum: ['Nepal', 'India', 'Other'],
    default: 'Nepal'
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: { type: Date, default: Date.now }
  }],
  invitations: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: String,
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    invitedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const Group = mongoose.model('Group', groupSchema);
export default Group;
