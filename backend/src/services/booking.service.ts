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
import redis from '../config/redis';
import { estimateSingleFare } from './fare.service';

// ─── Valid State Transitions ────────────────────────────

const VALID_TRANSITIONS: Record<BookingState, BookingState[]> = {
    SEARCHING: ['CONFIRMED', 'FAILED', 'CANCELLED', 'MANUAL_ESCALATION'],
    CONFIRMED: ['IN_PROGRESS', 'CANCELLED', 'FAILED'],
    IN_PROGRESS: ['COMPLETED', 'FAILED'],
    COMPLETED: [],
    FAILED: ['SEARCHING', 'MANUAL_ESCALATION'],
    CANCELLED: [],
    MANUAL_ESCALATION: ['CONFIRMED', 'CANCELLED', 'FAILED'],
};

// ─── Fare Estimation ────────────────────────────────────
// Delegates to fare.service.ts estimateSingleFare() which uses
// mode-specific rates, surge pricing, road factor correction,
// and airport detection. Falls back to CAB mode when no
// transportMode is available (e.g. legacy bookings without mode).
//
// When a quoteId is present, the fare from the cached quote is
// used instead (see createBooking below), bypassing this entirely.

function estimateFare(
    pickupLat?: number | null,
    pickupLng?: number | null,
    dropoffLat?: number | null,
    dropoffLng?: number | null,
    transportMode?: string,
): number {
    return estimateSingleFare(
        (transportMode as 'CAB' | 'BIKE' | 'AUTO' | 'METRO') || 'CAB',
        pickupLat ?? undefined,
        pickupLng ?? undefined,
        dropoffLat ?? undefined,
        dropoffLng ?? undefined,
    );
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
    transportMode?: 'CAB' | 'BIKE' | 'AUTO' | 'METRO';
    // FIX 2: Added quoteId to the params type. Previously the controller passed
    // this but the service signature didn't accept it, so it was silently dropped
    // and assignProvider always re-ran the full scoring engine regardless of what
    // the user selected on the results screen.
    quoteId?: string;
    fareEstimate?: number;
}) {
    // FIX 2 (continued): If a quoteId was provided, look up the cached quote in
    // Redis to get the pre-scored provider and fare the user selected. This means
    // we honour the user's choice from the results screen rather than re-running
    // scoring and potentially assigning a different provider.
    // If no quoteId (or cache miss), fall back to the Haversine estimate and
    // re-run assignProvider as before.
    let resolvedFare = params.fareEstimate ?? estimateFare(
        params.pickupLat, params.pickupLng,
        params.dropoffLat, params.dropoffLng,
        params.transportMode,
    );
    let cachedProviderId: string | null = null;

    if (params.quoteId) {
        try {
            // Look up the individual quote the user selected from the results screen.
            // Key is quote_item:<quoteId> — written by quotes.controller.ts.
            // The session-level quote:<sessionId> key is NOT used here because the
            // frontend passes selectedRide.id (individual quote UUID), not the
            // session quoteId.
            const raw = await redis.get(`quote_item:${params.quoteId}`);
            const cachedQuote = raw ? JSON.parse(raw) : null;

            if (cachedQuote) {
                resolvedFare = cachedQuote.farePaise;
                cachedProviderId = cachedQuote.providerId; // null for metro
                console.log(`[Booking] Quote cache hit for ${params.quoteId} — provider: ${cachedProviderId}, fare: ${resolvedFare}`);
            } else {
                // Cache miss: quote expired (>5 min) or never existed
                console.warn(`[Booking] Quote cache miss for ${params.quoteId} — falling back to scoring`);
            }
        } catch (err) {
            console.warn(`[Booking] Quote cache lookup failed for ${params.quoteId}, falling back to scoring`);
        }
    }

    const tripType = params.tripType || 'HIGH_RELIABILITY';

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
            transportMode: (params.transportMode || 'CAB') as any,
            state: 'SEARCHING',
            fareEstimate: resolvedFare,
            timeoutAt: new Date(Date.now() + 5 * 60 * 1000),
        },
    });

    await logBookingEvent(booking.id, 'CREATED', `Booking created: ${params.pickup} → ${params.dropoff}`);

    if (cachedProviderId) {
        // Fast path: we already know which provider the user selected.
        // Assign directly without re-running the scoring engine.
        assignCachedProvider(booking.id, cachedProviderId).catch(err => {
            console.error(`Cached provider assignment failed for booking ${booking.id}:`, err);
        });
    } else {
        // Normal path: run the scoring engine to find best available provider.
        assignProvider(booking.id, tripType as 'HIGH_RELIABILITY' | 'STANDARD').catch(err => {
            console.error(`Provider assignment failed for booking ${booking.id}:`, err);
        });
    }

    // ─── Demo Simulation ─────────────────────────────────
    // FIX 1: Gated behind NODE_ENV check so this never runs in production.
    //
    // Previously this setTimeout ran unconditionally in all environments and
    // raced with assignProvider. Both fired concurrently on every booking
    // creation. The race was mostly safe (the setTimeout guards with a state
    // check) but caused a specific failure in demo environments: with no real
    // providers in the DB, assignProvider fails → recovery fails → state goes
    // to FAILED. The setTimeout then fires, sees state is FAILED (not SEARCHING),
    // and does nothing. The booking was permanently stuck in FAILED with no
    // user-visible feedback.
    //
    // In development with no real providers, the simulation now fires correctly
    // because FAILED is no longer a terminal trap — see the extended state check
    // below which also handles FAILED state for demo purposes.
    //
    // To disable the simulation in dev too, set DISABLE_BOOKING_SIMULATION=true.
    if (
        process.env.NODE_ENV !== 'production' &&
        process.env.DISABLE_BOOKING_SIMULATION !== 'true'
    ) {
        setTimeout(async () => {
            try {
                const currentBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
                // FIX 1 (continued): Extended guard to also catch FAILED state,
                // which is what the booking ends up in when no real providers exist.
                // In a real deployment this branch never fires — the real provider
                // assignment will have already moved the booking to CONFIRMED.
                if (currentBooking && ['SEARCHING', 'FAILED'].includes(currentBooking.state)) {
                    // If the booking failed due to no providers, reset to SEARCHING
                    // first so the CONFIRMED transition is valid.
                    if (currentBooking.state === 'FAILED') {
                        await prisma.booking.update({
                            where: { id: booking.id },
                            data: { state: 'SEARCHING', previousState: 'FAILED' },
                        });
                    }
                    await transitionState(booking.id, 'CONFIRMED', {
                        provider: 'Sample Driver #42',
                        carModel: 'Maruti Suzuki Dzire',
                        plateNumber: 'TN-01-AB-1234',
                    });
                    console.log(`[Simulator] Booking ${booking.id} transitioned to CONFIRMED`);
                }
            } catch (err: any) {
                console.error('[Simulator] Transition failed:', err.message);
            }
        }, 8000);
    }

    return booking;
}

// ─── Assign Cached Provider (Fast Path) ─────────────────
// Used when a quoteId resolves to a cached provider from the results screen.
// Skips re-scoring since the user already made their selection.

async function assignCachedProvider(bookingId: string, providerId: string) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.state !== 'SEARCHING') return;

    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider || !provider.active) {
        // Provider went offline between quote and booking — fall back to scoring
        console.warn(`[Booking] Cached provider ${providerId} unavailable, falling back to scoring`);
        await assignProvider(bookingId, (booking.tripType as 'HIGH_RELIABILITY' | 'STANDARD'));
        return;
    }

    await prisma.bookingAttempt.create({
        data: {
            bookingId,
            providerId,
            attemptNumber: 1,
            success: true,
            score: null,
            reliability: provider.reliability,
            eta: null,
            fare: booking.fareEstimate,
        },
    });

    await prisma.booking.update({
        where: { id: bookingId },
        data: {
            providerId,
            providerType: 'INDIVIDUAL_DRIVER',
            state: 'CONFIRMED',
            previousState: 'SEARCHING',
            confirmedAt: new Date(),
        },
    });

    await logBookingEvent(
        bookingId,
        'PROVIDER_ASSIGNED',
        `Cached provider ${provider.name} assigned from quote selection`
    );
}

// ─── Assign Provider (Scoring Path) ─────────────────────

async function assignProvider(
    bookingId: string,
    tripType: 'HIGH_RELIABILITY' | 'STANDARD'
) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.state !== 'SEARCHING') return;

    const previousAttempts = await prisma.bookingAttempt.findMany({
        where: { bookingId },
        select: { providerId: true },
    });
    const excludeIds = previousAttempts.map(a => a.providerId);

    const bestProvider = await findBestProvider(excludeIds, tripType);

    if (!bestProvider) {
        await logBookingEvent(bookingId, 'NO_PROVIDER_FOUND', 'No eligible provider found');

        const recovered = await attemptRecovery(bookingId);

        if (!recovered) {
            await transitionState(bookingId, 'FAILED');
            await logBookingEvent(bookingId, 'FAILED', 'No provider available after all attempts');
            await issueCompensation(booking.userId, booking.userPhone, bookingId);
        }
        return;
    }

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

    await prisma.booking.update({
        where: { id: bookingId },
        data: {
            providerId: bestProvider.providerId,
            providerType: 'INDIVIDUAL_DRIVER',
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

    switch (newState) {
        case 'CONFIRMED':
            updateData.confirmedAt = new Date();
            break;
        case 'IN_PROGRESS':
            updateData.startedAt = new Date();
            break;
        case 'COMPLETED':
            updateData.completedAt = new Date();
            updateData.fareActual = booking.fareEstimate;
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

    if (newState === 'COMPLETED' && booking.providerId) {
        await updateProviderMetrics(booking.providerId, true);
    } else if (newState === 'FAILED' && booking.providerId) {
        await updateProviderMetrics(booking.providerId, false);
    }

    return true;
}

// ─── Get Booking Details ────────────────────────────────

export async function getBookingById(bookingId: string) {
    return prisma.booking.findUnique({
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

    await prisma.provider.update({
        where: { id: providerId },
        data: {
            totalRides: { increment: 1 },
            ...(success ? { successfulRides: { increment: 1 } } : {}),
            lastActiveAt: new Date(),
        },
    });

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