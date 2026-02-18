/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ BOOKING SERVICE — State Machine & Business Logic
 * ═══════════════════════════════════════════════════════════
 * 
 *  Booking State Machine:
 *  
 *  SEARCHING → CONFIRMED → IN_PROGRESS → COMPLETED
 *       ↓          ↓           ↓
 *     FAILED    CANCELLED   FAILED
 *       ↓
 *  MANUAL_ESCALATION
 * ═══════════════════════════════════════════════════════════
 */

import { BookingState, TripType } from '@prisma/client';
import prisma from '../config/database';
import { findBestProvider, ScoredProvider } from './provider-scoring.service';
import { attemptRecovery, issueCompensation } from './recovery.service';

// ─── Valid State Transitions ────────────────────────────

const VALID_TRANSITIONS: Record<BookingState, BookingState[]> = {
    SEARCHING: ['CONFIRMED', 'FAILED', 'CANCELLED', 'MANUAL_ESCALATION'],
    CONFIRMED: ['IN_PROGRESS', 'CANCELLED', 'FAILED'],
    IN_PROGRESS: ['COMPLETED', 'FAILED'],
    COMPLETED: [],
    FAILED: ['SEARCHING', 'MANUAL_ESCALATION'],  // Can retry
    CANCELLED: [],
    MANUAL_ESCALATION: ['CONFIRMED', 'CANCELLED', 'FAILED'],
};

// ─── Fare Estimation ────────────────────────────────────

function estimateFare(
    pickupLat?: number | null,
    pickupLng?: number | null,
    dropoffLat?: number | null,
    dropoffLng?: number | null
): number {
    // Simple fare estimation (₹ in paise)
    // In production, this would use Google Maps Distance API
    if (pickupLat && pickupLng && dropoffLat && dropoffLng) {
        const R = 6371; // Earth radius in km
        const dLat = (dropoffLat - pickupLat) * Math.PI / 180;
        const dLng = (dropoffLng - pickupLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(pickupLat * Math.PI / 180) * Math.cos(dropoffLat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = R * c;

        // ₹12/km base rate, ₹50 minimum, stored in paise
        const fareRupees = Math.max(50, Math.round(distanceKm * 12));
        return fareRupees * 100; // Convert to paise
    }

    // Default fare if no coordinates
    return 15000; // ₹150 in paise
}

// ─── Create Booking ─────────────────────────────────────

export async function createBooking(params: {
    userId: string;
    userPhone: string;
    pickup: string;
    pickupLat?: number;
    pickupLng?: number;
    dropoff: string;
    dropoffLat?: number;
    dropoffLng?: number;
    tripType?: 'HIGH_RELIABILITY' | 'STANDARD';
}) {
    const fareEstimate = estimateFare(
        params.pickupLat, params.pickupLng,
        params.dropoffLat, params.dropoffLng
    );

    const tripType = params.tripType || 'HIGH_RELIABILITY';

    // Create booking in SEARCHING state
    const booking = await prisma.booking.create({
        data: {
            userId: params.userId,
            userPhone: params.userPhone,
            pickup: params.pickup,
            pickupLat: params.pickupLat,
            pickupLng: params.pickupLng,
            dropoff: params.dropoff,
            dropoffLat: params.dropoffLat,
            dropoffLng: params.dropoffLng,
            tripType: tripType as TripType,
            state: 'SEARCHING',
            fareEstimate,
            timeoutAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min timeout
        },
    });

    // Log creation event
    await logBookingEvent(booking.id, 'CREATED', `Booking created: ${params.pickup} → ${params.dropoff}`);

    // Start async provider search
    assignProvider(booking.id, tripType as 'HIGH_RELIABILITY' | 'STANDARD').catch(err => {
        console.error(`Provider assignment failed for booking ${booking.id}:`, err);
    });

    return booking;
}

// ─── Assign Provider ────────────────────────────────────

async function assignProvider(
    bookingId: string,
    tripType: 'HIGH_RELIABILITY' | 'STANDARD'
) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.state !== 'SEARCHING') return;

    // Get previously attempted provider IDs
    const previousAttempts = await prisma.bookingAttempt.findMany({
        where: { bookingId },
        select: { providerId: true },
    });
    const excludeIds = previousAttempts.map(a => a.providerId);

    // Find best provider using The Brain
    const bestProvider = await findBestProvider(excludeIds, tripType);

    if (!bestProvider) {
        await logBookingEvent(bookingId, 'NO_PROVIDER_FOUND', 'No eligible provider found');

        // Trigger recovery flow
        const recovered = await attemptRecovery(bookingId);

        if (!recovered) {
            await transitionState(bookingId, 'FAILED');
            await logBookingEvent(bookingId, 'FAILED', 'No provider available after all attempts');

            // Issue compensation
            await issueCompensation(booking.userId, booking.userPhone, bookingId);
        }
        return;
    }

    // Record the assignment attempt
    const attemptCount = excludeIds.length + 1;
    await prisma.bookingAttempt.create({
        data: {
            bookingId,
            providerId: bestProvider.providerId,
            attemptNumber: attemptCount,
            success: true,
            score: bestProvider.score,
            reliability: bestProvider.reliability,
            eta: bestProvider.eta,
            fare: bestProvider.fare,
        },
    });

    // Update booking with provider
    await prisma.booking.update({
        where: { id: bookingId },
        data: {
            providerId: bestProvider.providerId,
            providerType: 'INDIVIDUAL_DRIVER', // Will be dynamic later
            state: 'CONFIRMED',
            previousState: 'SEARCHING',
            confirmedAt: new Date(),
        },
    });

    await logBookingEvent(
        bookingId,
        'PROVIDER_ASSIGNED',
        `Provider ${bestProvider.name} assigned (score: ${bestProvider.score})`
    );
}

// ─── State Transitions ──────────────────────────────────

export async function transitionState(
    bookingId: string,
    newState: BookingState,
    metadata?: Record<string, unknown>
): Promise<boolean> {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new Error('Booking not found');

    const validNextStates = VALID_TRANSITIONS[booking.state];
    if (!validNextStates.includes(newState)) {
        throw new Error(
            `Invalid transition: ${booking.state} → ${newState}. Valid: [${validNextStates.join(', ')}]`
        );
    }

    const updateData: Record<string, unknown> = {
        state: newState,
        previousState: booking.state,
        metadata: metadata || booking.metadata,
    };

    // Set timestamps based on transition
    switch (newState) {
        case 'CONFIRMED':
            updateData.confirmedAt = new Date();
            break;
        case 'IN_PROGRESS':
            updateData.startedAt = new Date();
            break;
        case 'COMPLETED':
            updateData.completedAt = new Date();
            // Calculate actual fare and commission
            updateData.fareActual = booking.fareEstimate; // For now, same as estimate
            updateData.commissionAmount = Math.round(booking.fareEstimate * booking.commissionRate);
            break;
        case 'FAILED':
            updateData.failedAt = new Date();
            break;
    }

    await prisma.booking.update({
        where: { id: bookingId },
        data: updateData,
    });

    await logBookingEvent(
        bookingId,
        `STATE_${newState}`,
        `State changed: ${booking.state} → ${newState}`
    );

    // Update provider metrics on completion
    if (newState === 'COMPLETED' && booking.providerId) {
        await updateProviderMetrics(booking.providerId, true);
    } else if (newState === 'FAILED' && booking.providerId) {
        await updateProviderMetrics(booking.providerId, false);
    }

    return true;
}

// ─── Get Booking Details ────────────────────────────────

export async function getBookingById(bookingId: string) {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            provider: {
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    vehicleModel: true,
                    vehiclePlate: true,
                    rating: true,
                    reliability: true,
                },
            },
            attempts: {
                orderBy: { attemptNumber: 'asc' },
            },
            logs: {
                orderBy: { createdAt: 'desc' },
                take: 20,
            },
        },
    });

    return booking;
}

export async function getUserBookings(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
        prisma.booking.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        vehicleModel: true,
                        vehiclePlate: true,
                        rating: true,
                    },
                },
            },
        }),
        prisma.booking.count({ where: { userId } }),
    ]);

    return {
        bookings,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// ─── Booking Event Log ──────────────────────────────────

async function logBookingEvent(
    bookingId: string,
    event: string,
    message: string,
    metadata?: Record<string, unknown>
) {
    await prisma.bookingLog.create({
        data: {
            bookingId,
            event,
            message,
            metadata: (metadata || undefined) as any,
        },
    });
}

// ─── Provider Metrics Update ────────────────────────────

async function updateProviderMetrics(providerId: string, success: boolean) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Upsert daily metrics
    await prisma.providerMetric.upsert({
        where: {
            providerId_date: {
                providerId,
                date: today,
            },
        },
        create: {
            providerId,
            date: today,
            totalBookings: 1,
            successfulBookings: success ? 1 : 0,
            failedBookings: success ? 0 : 1,
        },
        update: {
            totalBookings: { increment: 1 },
            ...(success
                ? { successfulBookings: { increment: 1 } }
                : { failedBookings: { increment: 1 } }),
        },
    });

    // Update provider aggregate stats
    await prisma.provider.update({
        where: { id: providerId },
        data: {
            totalRides: { increment: 1 },
            ...(success ? { successfulRides: { increment: 1 } } : {}),
            lastActiveAt: new Date(),
        },
    });

    // Recalculate reliability
    const provider = await prisma.provider.findUnique({
        where: { id: providerId },
        select: { totalRides: true, successfulRides: true },
    });

    if (provider && provider.totalRides > 0) {
        const newReliability = provider.successfulRides / provider.totalRides;
        await prisma.provider.update({
            where: { id: providerId },
            data: { reliability: Math.round(newReliability * 100) / 100 },
        });
    }
}
