import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateToken } from '../services/jwt.service';
import { generateReferralCode } from '../utils/otp';

// ─── Google OAuth2 (no Passport — direct REST flow) ─────
//
// Flow:
//   GET /api/v1/auth/google          → redirect to Google consent screen
//   GET /api/v1/auth/google/callback → exchange code, upsert user, return JWT

export function googleRedirect(_req: Request, res: Response): void {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const callbackUrl = process.env.OAUTH_CALLBACK_URL;

    if (!clientId || !callbackUrl) {
        res.status(503).json({ success: false, error: 'Google OAuth not configured' });
        return;
    }

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('access_type', 'online');

    res.redirect(url.toString());
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
        res.redirect(`${frontendUrl}?auth_error=missing_code`);
        return;
    }

    try {
        // ── 1. Exchange auth code for id_token ────────────────
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: process.env.OAUTH_CALLBACK_URL,
                grant_type: 'authorization_code',
            }),
        });

        const tokenData = await tokenRes.json() as any;

        if (!tokenData.id_token) {
            console.error('[OAuth] Token exchange failed:', tokenData);
            res.redirect(`${frontendUrl}?auth_error=token_exchange_failed`);
            return;
        }

        // ── 2. Decode id_token payload (Google already verified it) ──
        const [, payloadB64] = tokenData.id_token.split('.');
        const profile = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as {
            sub: string;       // Google user ID
            email?: string;
            name?: string;
        };

        const googleId = profile.sub;
        const phoneKey = `oauth_google_${googleId}`;

        // ── 3. Upsert user ────────────────────────────────────
        let user = await prisma.user.findFirst({ where: { phone: phoneKey } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    phone: phoneKey,
                    name: profile.name || null,
                    email: profile.email || null,
                    referralCode: generateReferralCode(),
                },
            });
        } else if (profile.email && !user.email) {
            // Backfill email if user logged in before this was added
            user = await prisma.user.update({
                where: { id: user.id },
                data: { email: profile.email },
            });
        }

        // ── 4. Generate JWT (same shape as OTP flow) ──────────
        const token = generateToken({ userId: user.id, phone: user.phone });

        // ── 5. Redirect to frontend with token ────────────────
        res.redirect(`${frontendUrl}?token=${token}`);

    } catch (err: any) {
        console.error('[OAuth] Callback error:', err.message);
        res.redirect(`${frontendUrl}?auth_error=server_error`);
    }
}
