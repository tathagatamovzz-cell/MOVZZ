import { Request, Response } from 'express';
import prisma from '../config/database';
import redis from '../config/redis';
import smsService from '../services/sms.service';
import { generateToken } from '../services/jwt.service';
import { generateOTP, generateReferralCode } from '../utils/otp';
import { isValidIndianPhone, normalizePhone } from '../utils/phone';
import { sendOTPSchema, verifyOTPSchema } from '../validators/auth.validator';

export async function sendOTP(req: Request, res: Response): Promise<void> {
  try {
    const result = sendOTPSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
      return;
    }

    const { phone: rawPhone } = result.data;
    const phone = normalizePhone(rawPhone);

    if (!isValidIndianPhone(phone)) {
      res.status(400).json({
        success: false,
        error: 'Invalid Indian phone number'
      });
      return;
    }

    const otp = generateOTP();
    await smsService.sendOTP(phone, otp);

    res.json({
      success: true,
      message: `OTP sent to ${phone}`,
      expiresIn: 300,
      // Include OTP in dev mode for easy testing
      ...(process.env.NODE_ENV !== 'production' && { otp }),
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send OTP'
    });
  }
}

export async function verifyOTP(req: Request, res: Response): Promise<void> {
  try {
    const result = verifyOTPSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid OTP format'
      });
      return;
    }

    const { phone: rawPhone, otp } = result.data;
    const phone = normalizePhone(rawPhone);

    const storedOTP = await redis.get(`otp:${phone}`);

    if (!storedOTP || storedOTP !== otp) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired OTP'
      });
      return;
    }

    await redis.del(`otp:${phone}`);

    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          referralCode: generateReferralCode()
        }
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const token = generateToken({
      userId: user.id,
      phone: user.phone
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        referralCode: user.referralCode
      }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify OTP'
    });
  }
}