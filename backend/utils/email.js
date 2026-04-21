import nodemailer from 'nodemailer';

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

export const sendOTPEmail = async (email, otp, purpose = 'verify') => {
  const transporter = createTransporter();

  const subject = purpose === 'verify'
    ? 'FlatShare - Verify Your Email'
    : 'FlatShare - Password Reset OTP';

  const message = purpose === 'verify'
    ? `Your email verification code is: <strong>${otp}</strong>. It expires in 10 minutes.`
    : `Your password reset code is: <strong>${otp}</strong>. It expires in 10 minutes.`;

  const mailOptions = {
    from: `"FlatShare App" <${process.env.EMAIL_USER}>`,
    to: email,
    subject,
    html: `
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
    `
  };

  await transporter.sendMail(mailOptions);
};

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
