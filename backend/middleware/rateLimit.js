import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

const tooManyRequests = (message) => (req, res, next, options) => {
  res.status(options.statusCode).json({ success: false, message });
};

// Credential checks (login, OTP verification, password reset).
// Limits guessing from a single client.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooManyRequests('Too many attempts. Please try again in a few minutes.')
});

// Endpoints that send an email. Keyed by client IP and target address so one
// person cannot flood an inbox, while people sharing a network (e.g. a campus)
// are not blocked by each other.
export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return `${ipKeyGenerator(req.ip)}:${email}`;
  },
  handler: tooManyRequests('Too many code requests. Please wait before requesting another code.')
});

// Overall cap on emails a single client can trigger, regardless of address.
export const emailBurstLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooManyRequests('Too many code requests. Please try again later.')
});
