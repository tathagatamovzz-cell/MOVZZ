/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ BOOKING CONTROLLER — API Endpoint Handlers
 * ═══════════════════════════════════════════════════════════
 */

import { Request, Response } from 'express';
import { createBookingSchema } from '../validators/booking.validator';
import {
    createBooking,
    getBookingById,
    getUserBookings,
    transitionState,
} from '../services/booking.service';
import { getUserCredits } from '../services/recovery.service';

// ─── Create Booking ─────────────────────────────────────

export async function createBookingHandler(req: Request, res: Response): Promise<void> {
    try {
        const result = createBookingSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: 'Invalid booking data',
                details: result.error.issues,
            });
            return;
        }

        if (!req.user) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const booking = await createBooking({
            userId: req.user.userId,
            userPhone: req.user.phone,
            transportMode: result.data.transportMode,
            ...result.data,
        });

        res.status(201).json({
            success: true,
            data: {
                id: booking.id,
                state: booking.state,
                pickup: booking.pickup,
                dropoff: booking.dropoff,
                fareEstimate: booking.fareEstimate,
                fareEstimateRupees: booking.fareEstimate / 100,
                tripType: booking.tripType,
                timeoutAt: booking.timeoutAt,
                createdAt: booking.createdAt,
            },
            message: 'Booking created. Searching for provider...',
        });
    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create booking',
        });
    }
}

// ─── Get Booking Status ─────────────────────────────────

export async function getBookingHandler(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;
        const booking = await getBookingById(id);

        if (!booking) {
            res.status(404).json({ success: false, error: 'Booking not found' });
            return;
        }

        // Ensure user can only see their own bookings
        if (req.user && booking.userId !== req.user.userId) {
            res.status(403).json({ success: false, error: 'Access denied' });
            return;
        }

        res.json({
            success: true,
            data: {
                id: booking.id,
                state: booking.state,
                pickup: booking.pickup,
                dropoff: booking.dropoff,
                fareEstimate: booking.fareEstimate,
                fareEstimateRupees: booking.fareEstimate / 100,
                fareActual: booking.fareActual,
                fareActualRupees: booking.fareActual ? booking.fareActual / 100 : null,
                tripType: booking.tripType,
                provider: booking.provider,
                attempts: booking.attempts.length,
                logs: booking.logs,
                createdAt: booking.createdAt,
                confirmedAt: booking.confirmedAt,
                completedAt: booking.completedAt,
                timeoutAt: booking.timeoutAt,
            },
        });
    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get booking',
        });
    }
}

// ─── Get User's Bookings ────────────────────────────────

export async function getUserBookingsHandler(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

        const result = await getUserBookings(req.user.userId, page, limit);

        res.json({
            success: true,
            data: result.bookings,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error('Get user bookings error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get bookings',
        });
    }
}

// ─── Cancel Booking ─────────────────────────────────────

export async function cancelBookingHandler(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;
        const booking = await getBookingById(id);

        if (!booking) {
            res.status(404).json({ success: false, error: 'Booking not found' });
            return;
        }

        if (req.user && booking.userId !== req.user.userId) {
            res.status(403).json({ success: false, error: 'Access denied' });
            return;
        }

        await transitionState(id as string, 'CANCELLED');

        res.json({
            success: true,
            message: 'Booking cancelled',
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to cancel booking';
        console.error('Cancel booking error:', error);
        res.status(400).json({
            success: false,
            error: message,
        });
    }
}

// ─── Get User Credits ───────────────────────────────────

export async function getUserCreditsHandler(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const credits = await getUserCredits(req.user.userId);

        res.json({
            success: true,
            data: credits,
        });
    } catch (error) {
        console.error('Get credits error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get credits',
        });
    }
}
