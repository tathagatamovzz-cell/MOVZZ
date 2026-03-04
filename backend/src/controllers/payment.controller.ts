/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ PAYMENT CONTROLLER — Razorpay Payment Links
 * ═══════════════════════════════════════════════════════════
 *
 *  POST /api/v1/payments/create-link
 *    → Creates a Razorpay Payment Link
 *    → Returns shortUrl — frontend redirects user to it
 *
 *  POST /api/v1/payments/verify
 *    → Validates callback params after user returns from Razorpay
 *    → HMAC-SHA256 signature check on payment link params
 *    → Marks booking as paid, schedules provider payout (T+2)
 * ═══════════════════════════════════════════════════════════
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import {
    createPaymentLink,
    verifyPaymentLink,
    scheduleProviderPayout,
} from '../services/payment.service';

// ─── POST /api/v1/payments/create-link ──────────────────

export async function createLinkHandler(req: Request, res: Response): Promise<void> {
    try {
        const { bookingId } = req.body as { bookingId?: string };

        if (!bookingId) {
            res.status(400).json({ success: false, error: 'bookingId is required' });
            return;
        }

        if (!req.user) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

        if (!booking) {
            res.status(404).json({ success: false, error: 'Booking not found' });
            return;
        }

        if (booking.userId !== req.user.userId) {
            res.status(403).json({ success: false, error: 'Access denied' });
            return;
        }

        if (booking.paidAt) {
            res.status(409).json({ success: false, error: 'Booking is already paid' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { phone: true },
        });

        const result = await createPaymentLink({
            bookingId,
            amountPaise: booking.fareEstimate,
            customerPhone: user?.phone,
            pickup: booking.pickup,
            dropoff: booking.dropoff,
        });

        res.status(201).json({
            success: true,
            data: {
                shortUrl: result.shortUrl,
                paymentLinkId: result.paymentLinkId,
                bookingId,
                amountRupees: Math.round(booking.fareEstimate / 100),
            },
        });
    } catch (err: any) {
        console.error('[Payment] createLink error:', err.message);

        if (err.message?.includes('RAZORPAY_KEY')) {
            res.status(503).json({ success: false, error: 'Payment service not configured' });
            return;
        }

        res.status(500).json({ success: false, error: err.message || 'Failed to create payment link' });
    }
}

// ─── POST /api/v1/payments/verify ───────────────────────

export async function verifyPaymentHandler(req: Request, res: Response): Promise<void> {
    try {
        const {
            bookingId,
            razorpayPaymentId,
            razorpayPaymentLinkId,
            razorpayPaymentLinkRefId,
            razorpayPaymentLinkStatus,
            razorpaySignature,
        } = req.body as {
            bookingId?: string;
            razorpayPaymentId?: string;
            razorpayPaymentLinkId?: string;
            razorpayPaymentLinkRefId?: string;
            razorpayPaymentLinkStatus?: string;
            razorpaySignature?: string;
        };

        if (!bookingId || !razorpayPaymentId || !razorpayPaymentLinkId ||
            !razorpayPaymentLinkRefId || !razorpayPaymentLinkStatus || !razorpaySignature) {
            res.status(400).json({
                success: false,
                error: 'bookingId, razorpayPaymentId, razorpayPaymentLinkId, razorpayPaymentLinkRefId, razorpayPaymentLinkStatus, and razorpaySignature are all required',
            });
            return;
        }

        if (!req.user) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

        if (!booking) {
            res.status(404).json({ success: false, error: 'Booking not found' });
            return;
        }

        if (booking.userId !== req.user.userId) {
            res.status(403).json({ success: false, error: 'Access denied' });
            return;
        }

        await verifyPaymentLink({
            bookingId,
            razorpayPaymentId,
            razorpayPaymentLinkId,
            razorpayPaymentLinkRefId,
            razorpayPaymentLinkStatus,
            razorpaySignature,
        });

        // Schedule T+2 provider payout (fire-and-forget)
        scheduleProviderPayout(bookingId).catch(err =>
            console.error('[Payment] Payout scheduling failed:', err.message)
        );

        res.json({
            success: true,
            data: {
                bookingId,
                paidAt: new Date().toISOString(),
                message: 'Payment verified. Your ride is confirmed!',
            },
        });
    } catch (err: any) {
        console.error('[Payment] verify error:', err.message);

        if (err.message?.includes('invalid signature') || err.message?.includes('mismatch')) {
            res.status(400).json({ success: false, error: 'Payment verification failed' });
            return;
        }

        res.status(500).json({ success: false, error: 'Payment verification error' });
    }
}
