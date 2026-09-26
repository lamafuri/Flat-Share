import jwt from 'jsonwebtoken';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// In production the frontend (Vercel) and API (Render) are on different
// sites, so a SameSite=Strict/Lax cookie is never sent with API requests.
// Cross-site cookies must be SameSite=None, which browsers only accept
// together with Secure. Locally both run on localhost, where Lax works.
export const authCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  };
};

export const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);

  const cookieOptions = {
    ...authCookieOptions(),
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };

  res.status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        isVerified: user.isVerified
      }
    });
};
