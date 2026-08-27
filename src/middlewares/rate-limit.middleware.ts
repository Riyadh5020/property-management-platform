import rateLimit from 'express-rate-limit';

const isProd = process.env.NODE_ENV === 'production';

export const loginRateLimiter = rateLimit({
  windowMs: isProd ? 15 * 60 * 1000 : 60 * 1000,
  max: isProd ? 5 : 50,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many login attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
