import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/jwt.service';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        phone: string;
      };
    }
  }
}

export function authenticateUser(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    console.log('[Auth] Header:', authHeader ? 'Present' : 'Missing');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Auth] No Bearer token');
      res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
      return;
    }

    const token = authHeader.substring(7);
    console.log('[Auth] Token length:', token.length, 'Starts with:', token.substring(0, 20));

    const payload = verifyToken(token);
    console.log('[Auth] Token valid. userId:', payload.userId);

    req.user = {
      userId: payload.userId,
      phone: payload.phone
    };

    next();

  } catch (error: any) {
    console.log('[Auth] Error:', error.message);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
}