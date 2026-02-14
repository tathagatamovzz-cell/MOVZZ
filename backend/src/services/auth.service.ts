import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { config } from '../config/config';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export class AuthService {
  async sendOTP(phone: string): Promise<void> {
    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Find or create user
    let user = await prisma.user.findUnique({ where: { phone } });
    
    if (!user) {
      user = await prisma.user.create({
        data: { phone },
      });
    }

    // Delete old OTP codes for this phone
    await prisma.oTPCode.deleteMany({
      where: { phone },
    });

    // Create new OTP
    await prisma.oTPCode.create({
      data: {
        userId: user.id,
        phone,
        code,
        expiresAt,
      },
    });

    // TODO: Send OTP via Twilio
    // For development, log the OTP
    if (config.env === 'development') {
      logger.info(`📱 OTP for ${phone}: ${code}`);
    } else {
      // In production, send via Twilio
      // await this.sendSMS(phone, `Your MOVZZ OTP is: ${code}`);
    }
  }

  async verifyOTP(phone: string, code: string): Promise<{
    user: any;
    accessToken: string;
    refreshToken: string;
  }> {
    // Find OTP
    const otpRecord = await prisma.oTPCode.findFirst({
      where: {
        phone,
        code,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!otpRecord) {
      // Increment attempts
      await prisma.oTPCode.updateMany({
        where: { phone, code },
        data: { attempts: { increment: 1 } },
      });

      throw new AppError(400, 'Invalid or expired OTP');
    }

    // Check attempts
    if (otpRecord.attempts >= 3) {
      throw new AppError(400, 'Too many attempts. Please request a new OTP');
    }

    // Mark OTP as verified
    await prisma.oTPCode.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    // Mark user as verified
    await prisma.user.update({
      where: { id: otpRecord.userId },
      data: {
        isVerified: true,
        lastLoginAt: new Date(),
      },
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(otpRecord.user);
    const refreshToken = this.generateRefreshToken(otpRecord.user);

    return {
      user: {
        id: otpRecord.user.id,
        phone: otpRecord.user.phone,
        email: otpRecord.user.email,
        name: otpRecord.user.name,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as {
        userId: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        throw new AppError(401, 'User not found');
      }

      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new AppError(401, 'Invalid refresh token');
    }
  }

  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        profileImage: true,
        preferredLanguage: true,
        preferredPayment: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    return user;
  }

  private generateAccessToken(user: any): string {
    return jwt.sign(
      {
        userId: user.id,
        phone: user.phone,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  private generateRefreshToken(user: any): string {
    return jwt.sign(
      {
        userId: user.id,
      },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
  }
}
