import crypto from 'crypto';

// Emails are sent through Brevo's HTTPS API rather than SMTP: Render's free
// tier blocks outbound SMTP ports (25, 465, 587), so SMTP connections to Gmail
// time out in production.
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const EMAIL_TIMEOUT_MS = 10000;

export const isEmailConfigured = () =>
  Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_FROM);

export const sendOTPEmail = async (email, otp, purpose = 'verify') => {
  const subject = purpose === 'verify'
    ? 'FlatShare - Verify Your Email'
    : 'FlatShare - Password Reset OTP';

  const message = purpose === 'verify'
    ? `Your email verification code is: <strong>${otp}</strong>. It expires in 10 minutes.`
    : `Your password reset code is: <strong>${otp}</strong>. It expires in 10 minutes.`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
      <h2 style="color: #111827; margin-bottom: 8px;">FlatShare</h2>
      <p style="color: #6b7280; font-size: 14px;">Flat expense sharing made simple</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #374151;">${message}</p>
      <div style="background: #111827; color: #fff; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 24px; border-radius: 8px; margin: 24px 0;">
        ${otp}
      </div>
      <p style="color: #9ca3af; font-size: 12px;">If you didn't request this, please ignore this email.</p>
    </div>
  `;

  if (!isEmailConfigured()) {
    // Local development without an email provider: print the code so the
    // registration and password reset flows can still be used.
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[email] Brevo is not configured. ${purpose} code for ${email}: ${otp}`);
      return;
    }
    throw new Error('Email service is not configured: set BREVO_API_KEY and EMAIL_FROM');
  }

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      sender: { name: process.env.EMAIL_FROM_NAME || 'FlatShare App', email: process.env.EMAIL_FROM },
      to: [{ email }],
      subject,
      htmlContent: html
    }),
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Brevo API responded with ${response.status}: ${detail.slice(0, 300)}`);
  }
};

export const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};
