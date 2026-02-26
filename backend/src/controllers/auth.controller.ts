import { Request, Response } from 'express';
import prisma from '../config/database';
import redis from '../config/redis';
import { generateToken } from '../services/jwt.service';
import { generateOTP, generateReferralCode } from '../utils/otp';
import { normalizePhone } from '../utils/phone';

/**
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  MOVZZ NATIVE AUTHENTICATION (High Reliability)                ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

export async function sendOTP(req: Request, res: Response): Promise<void> {
  try {
    const { phone: input } = req.body;

    if (!input || typeof input !== 'string') {
      res.status(400).json({ success: false, error: 'Phone or Email is required' });
      return;
    }

    const isEmail = input.includes('@');
    const otp = generateOTP();
    const key = isEmail ? input.toLowerCase().trim() : normalizePhone(input);

    await redis.set(`otp:${key}`, otp, 300);

    console.log(`[MOVZZ AUTH] 🔑 OTP for ${key}: ${otp} (MOCK)`);

    res.json({
      success: true,
      data: {
        channel: isEmail ? 'email' : 'whatsapp',
        message: `OTP sent to ${isEmail ? 'email' : 'WhatsApp'} (Simulated)`,
        otp: process.env.NODE_ENV !== 'production' ? otp : undefined
      }
    });
  } catch (error: any) {
    console.error('[MOVZZ AUTH] Fatal Error:', error.message);
    res.status(500).json({ success: false, error: 'Internal Auth Error' });
  }
}

export async function verifyOTP(req: Request, res: Response): Promise<void> {
  try {
    const { phone: input, otp } = req.body;

    if (!input || !otp) {
      res.status(400).json({ success: false, error: 'All fields are required' });
      return;
    }

    const key = input.includes('@') ? input.toLowerCase().trim() : normalizePhone(input);

    const storedOtp = await redis.get(`otp:${key}`);
    if (!storedOtp || storedOtp !== otp) {
      res.status(401).json({ success: false, error: 'Invalid code' });
      return;
    }

    await redis.del(`otp:${key}`);

    // Persist user with either email or phone
    const isEmail = input.includes('@');
    let user = await prisma.user.findFirst({
      where: isEmail ? { name: input } : { phone: key }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: isEmail ? `email_${Date.now()}` : key,
          name: isEmail ? input : null,
          referralCode: generateReferralCode()
        }
      });
    }

    const token = generateToken({ userId: user.id, phone: user.phone });
    res.json({ success: true, data: { token, user } });

  } catch (error: any) {
    console.error('[MOVZZ AUTH] Verify Error:', error.message);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
}