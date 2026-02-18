/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ ADMIN CONTROLLER — Dashboard & Management API
 * ═══════════════════════════════════════════════════════════
 * 
 *  Admin endpoints for:
 *  - Manual booking confirmation
 *  - Provider management (CRUD, pause/resume)
 *  - Metrics & analytics viewing
 *  - Escalated booking handling
 * ═══════════════════════════════════════════════════════════
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import { transitionState } from '../services/booking.service';

// ─── Dashboard Overview ─────────────────────────────────

export async function getDashboard(_req: Request, res: Response): Promise<void> {
    try {
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        const [
            totalUsers,
            totalBookings,
            todayBookings,
            activeProviders,
            escalatedBookings,
            bookingsByState,
            recentBookings,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.booking.count(),
            prisma.booking.count({ where: { createdAt: { gte: today } } }),
            prisma.provider.count({ where: { active: true } }),
            prisma.booking.count({ where: { state: 'MANUAL_ESCALATION' } }),
            prisma.booking.groupBy({
                by: ['state'],
                _count: { id: true },
            }),
            prisma.booking.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    provider: { select: { name: true, phone: true } },
                },
            }),
        ]);

        const stateBreakdown: Record<string, number> = {};
        bookingsByState.forEach(s => {
            stateBreakdown[s.state] = s._count.id;
        });

        res.json({
            success: true,
            data: {
                overview: {
                    totalUsers,
                    totalBookings,
                    todayBookings,
                    activeProviders,
                    escalatedBookings,
                },
                bookingsByState: stateBreakdown,
                recentBookings,
            },
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ success: false, error: 'Failed to load dashboard' });
    }
}

// ─── Manual Booking Confirmation ────────────────────────

export async function manualConfirmBooking(req: Request, res: Response): Promise<void> {
    try {
        const bookingId = req.params.bookingId as string;
        const { providerId } = req.body;

        if (!providerId) {
            res.status(400).json({ success: false, error: 'providerId is required' });
            return;
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId as string },
        });

        if (!booking) {
            res.status(404).json({ success: false, error: 'Booking not found' });
            return;
        }

        if (booking.state !== 'MANUAL_ESCALATION' && booking.state !== 'FAILED') {
            res.status(400).json({
                success: false,
                error: `Cannot manually confirm booking in state: ${booking.state}`,
            });
            return;
        }

        // Verify provider exists and is active
        const provider = await prisma.provider.findUnique({
            where: { id: providerId as string },
        });

        if (!provider || !provider.active) {
            res.status(400).json({ success: false, error: 'Provider not found or inactive' });
            return;
        }

        // Assign provider and confirm
        await prisma.booking.update({
            where: { id: bookingId as string },
            data: {
                providerId,
                state: 'CONFIRMED',
                previousState: booking.state,
                confirmedAt: new Date(),
                manualIntervention: true,
            },
        });

        await prisma.bookingLog.create({
            data: {
                bookingId: bookingId as string,
                event: 'MANUAL_CONFIRMATION',
                message: `Manually assigned to provider ${provider.name} by admin`,
                metadata: { providerId, adminAction: true },
            },
        });

        res.json({
            success: true,
            message: `Booking ${bookingId} manually confirmed with provider ${provider.name}`,
        });
    } catch (error) {
        console.error('Manual confirm error:', error);
        res.status(500).json({ success: false, error: 'Failed to confirm booking' });
    }
}

// ─── Get Escalated Bookings ─────────────────────────────

export async function getEscalatedBookings(_req: Request, res: Response): Promise<void> {
    try {
        const bookings = await prisma.booking.findMany({
            where: { state: 'MANUAL_ESCALATION' },
            orderBy: { createdAt: 'asc' }, // Oldest first (FIFO)
            include: {
                user: { select: { id: true, phone: true, name: true } },
                attempts: {
                    include: {
                        provider: { select: { name: true, phone: true, reliability: true } },
                    },
                    orderBy: { attemptNumber: 'asc' },
                },
                logs: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });

        res.json({
            success: true,
            count: bookings.length,
            data: bookings,
        });
    } catch (error) {
        console.error('Escalated bookings error:', error);
        res.status(500).json({ success: false, error: 'Failed to get escalated bookings' });
    }
}

// ─── Provider Management ────────────────────────────────

export async function listProviders(req: Request, res: Response): Promise<void> {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const skip = (page - 1) * limit;
        const activeOnly = req.query.active === 'true';

        const [providers, total] = await Promise.all([
            prisma.provider.findMany({
                where: activeOnly ? { active: true } : undefined,
                orderBy: { reliability: 'desc' },
                skip,
                take: limit,
                include: {
                    _count: { select: { bookings: true } },
                },
            }),
            prisma.provider.count(activeOnly ? { where: { active: true } } : undefined),
        ]);

        res.json({
            success: true,
            data: providers,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('List providers error:', error);
        res.status(500).json({ success: false, error: 'Failed to list providers' });
    }
}

export async function createProvider(req: Request, res: Response): Promise<void> {
    try {
        const { name, phone, type, vehicleModel, vehiclePlate, commissionRate } = req.body;

        if (!name || !phone || !type) {
            res.status(400).json({
                success: false,
                error: 'name, phone, and type are required',
            });
            return;
        }

        const existing = await prisma.provider.findUnique({ where: { phone } });
        if (existing) {
            res.status(409).json({ success: false, error: 'Provider with this phone already exists' });
            return;
        }

        const provider = await prisma.provider.create({
            data: {
                name,
                phone,
                type,
                vehicleModel,
                vehiclePlate,
                commissionRate: commissionRate || 0.10,
            },
        });

        res.status(201).json({ success: true, data: provider });
    } catch (error) {
        console.error('Create provider error:', error);
        res.status(500).json({ success: false, error: 'Failed to create provider' });
    }
}

export async function updateProvider(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;
        const updateData = req.body;

        // Don't allow updating certain fields directly
        delete updateData.id;
        delete updateData.createdAt;
        delete updateData.totalRides;
        delete updateData.successfulRides;

        const provider = await prisma.provider.update({
            where: { id: id as string },
            data: updateData,
        });

        res.json({ success: true, data: provider });
    } catch (error) {
        console.error('Update provider error:', error);
        res.status(500).json({ success: false, error: 'Failed to update provider' });
    }
}

export async function pauseProvider(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;
        const { reason, durationHours } = req.body;

        const pausedUntil = new Date(Date.now() + (durationHours || 24) * 60 * 60 * 1000);

        const provider = await prisma.provider.update({
            where: { id: id as string },
            data: {
                active: false,
                pausedUntil,
                pauseReason: reason || 'Paused by admin',
            },
        });

        res.json({
            success: true,
            message: `Provider ${provider.name} paused until ${pausedUntil.toISOString()}`,
            data: provider,
        });
    } catch (error) {
        console.error('Pause provider error:', error);
        res.status(500).json({ success: false, error: 'Failed to pause provider' });
    }
}

export async function resumeProvider(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;

        const provider = await prisma.provider.update({
            where: { id: id as string },
            data: {
                active: true,
                pausedUntil: null,
                pauseReason: null,
            },
        });

        res.json({
            success: true,
            message: `Provider ${provider.name} resumed`,
            data: provider,
        });
    } catch (error) {
        console.error('Resume provider error:', error);
        res.status(500).json({ success: false, error: 'Failed to resume provider' });
    }
}

// ─── Metrics ────────────────────────────────────────────

export async function getProviderMetrics(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;
        const days = parseInt(req.query.days as string) || 7;

        const since = new Date();
        since.setDate(since.getDate() - days);

        const [provider, metrics] = await Promise.all([
            prisma.provider.findUnique({
                where: { id: id as string },
                select: {
                    id: true, name: true, phone: true, reliability: true,
                    rating: true, totalRides: true, successfulRides: true, active: true,
                },
            }),
            prisma.providerMetric.findMany({
                where: { providerId: id as string, date: { gte: since } },
                orderBy: { date: 'asc' },
            }),
        ]);

        if (!provider) {
            res.status(404).json({ success: false, error: 'Provider not found' });
            return;
        }

        res.json({
            success: true,
            data: {
                provider,
                metrics,
                summary: {
                    period: `${days} days`,
                    totalBookings: metrics.reduce((s, m) => s + m.totalBookings, 0),
                    successfulBookings: metrics.reduce((s, m) => s + m.successfulBookings, 0),
                    failedBookings: metrics.reduce((s, m) => s + m.failedBookings, 0),
                    avgReliability: metrics.length > 0
                        ? metrics.reduce((s, m) => s + m.reliabilityScore, 0) / metrics.length
                        : provider.reliability,
                },
            },
        });
    } catch (error) {
        console.error('Provider metrics error:', error);
        res.status(500).json({ success: false, error: 'Failed to get metrics' });
    }
}

export async function getSystemMetrics(_req: Request, res: Response): Promise<void> {
    try {
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        const thisWeek = new Date(now);
        thisWeek.setDate(thisWeek.getDate() - 7);

        const [
            todayStats,
            weekStats,
            topProviders,
            failureRate,
        ] = await Promise.all([
            // Today's booking stats
            prisma.booking.groupBy({
                by: ['state'],
                where: { createdAt: { gte: today } },
                _count: { id: true },
            }),
            // This week's totals
            prisma.booking.aggregate({
                where: { createdAt: { gte: thisWeek } },
                _count: { id: true },
                _sum: { fareActual: true, commissionAmount: true },
            }),
            // Top providers by reliability
            prisma.provider.findMany({
                where: { active: true, totalRides: { gt: 0 } },
                orderBy: { reliability: 'desc' },
                take: 5,
                select: {
                    id: true, name: true, reliability: true,
                    rating: true, totalRides: true, successfulRides: true,
                },
            }),
            // Failure rate
            prisma.booking.aggregate({
                where: { createdAt: { gte: thisWeek }, state: 'FAILED' },
                _count: { id: true },
            }),
        ]);

        const todayBreakdown: Record<string, number> = {};
        todayStats.forEach(s => { todayBreakdown[s.state] = s._count.id; });

        const weekTotal = weekStats._count.id || 0;
        const weekFailures = failureRate._count.id || 0;

        res.json({
            success: true,
            data: {
                today: todayBreakdown,
                week: {
                    totalBookings: weekTotal,
                    totalRevenue: weekStats._sum.fareActual || 0,
                    totalRevenueRupees: (weekStats._sum.fareActual || 0) / 100,
                    totalCommission: weekStats._sum.commissionAmount || 0,
                    totalCommissionRupees: (weekStats._sum.commissionAmount || 0) / 100,
                    failureRate: weekTotal > 0 ? ((weekFailures / weekTotal) * 100).toFixed(2) + '%' : '0%',
                },
                topProviders,
            },
        });
    } catch (error) {
        console.error('System metrics error:', error);
        res.status(500).json({ success: false, error: 'Failed to get system metrics' });
    }
}
