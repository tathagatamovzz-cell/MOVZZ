import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { sendOTP, verifyOTP } from '../controllers/auth.controller';
import { googleRedirect, googleCallback } from '../controllers/oauth.controller';

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  keyGenerator: (req) => req.body?.phone || req.ip || 'unknown',
  message: { success: false, error: 'Too many OTP attempts. Try again in 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.post('/send-otp', sendOTP);
router.post('/verify-otp', otpLimiter, verifyOTP);

// Google OAuth (no Passport — direct redirect flow)
router.get('/google', googleRedirect);
router.get('/google/callback', googleCallback);

export default router;