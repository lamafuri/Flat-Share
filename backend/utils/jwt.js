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
//
// Behind the NGINX reverse proxy (Docker/Kubernetes deployment) the frontend
// and API share one origin, and the site may be served over plain HTTP, where
// browsers drop Secure cookies. COOKIE_SECURE=false turns Secure off there,
// and SameSite falls back to Lax, which same-origin requests satisfy.
export const authCookieOptions = () => {
  const secure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax'
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
