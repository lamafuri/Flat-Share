import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import expenseRoutes from './routes/expenses.js';
import reportRoutes from './routes/reports.js';
import userRoutes from './routes/users.js';
import { isEmailConfigured } from './utils/email.js';

dotenv.config();

const app = express();

// Render terminates requests at a single reverse proxy that sets
// X-Forwarded-For. Trust exactly that one hop so req.ip is the client's IP.
app.set('trust proxy', 1);

// CLIENT_URL may hold several comma-separated origins (e.g. the production
// site and a preview deployment). Browsers send the Origin header without a
// trailing slash, so strip any from the configured values to avoid mismatches.
const allowedOrigins = (process.env.CLIENT_URL || 'https://flat-share-self.vercel.app')
  .split(',')
  .map(origin => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Connect to MongoDB
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`✅ CORS enabled for: ${allowedOrigins.join(', ')}`);
      if (!isEmailConfigured()) {
        console.warn('⚠️  BREVO_API_KEY or EMAIL_FROM is not set: OTP emails will not be delivered');
      }
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

export default app;