/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ RECOVERY & COMPENSATION SERVICE
 * ═══════════════════════════════════════════════════════════
 * 
 *  Handles failed bookings with:
 *  1. Retry logic — Try up to 3 providers
 *  2. Fallback — Relax filters and try again
 *  3. Auto-escalation — Flag for manual intervention
 *  4. Compensation — ₹100 credit for failed bookings
 * ═══════════════════════════════════════════════════════════
 */

import prisma from '../config/database';
import { findBestProvider } from './provider-scoring.service';

const MAX_RETRY_ATTEMPTS = 3;
const COMPENSATION_AMOUNT = 10000; // ₹100 in paise
const COMPENSATION_EXPIRY_DAYS = 30;

// ─── Attempt Recovery ───────────────────────────────────

/**
 * attemptRecovery — Try to find an alternative provider
 * 
 * Strategy:
 * 1. First retry: Same strict filters
 * 2. Second retry: Relaxed filters (70% reliability)
 * 3. Third retry: Most relaxed (any active provider)
 * 4. If all fail: Escalate to manual intervention
 */
export async function attemptRecovery(bookingId: string): Promise<boolean> {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            attempts: {
                select: { providerId: true },
            },
        },
    });

    if (!booking) return false;

    const currentAttempts = booking.recoveryAttempts;

    if (currentAttempts >= MAX_RETRY_ATTEMPTS) {
        // Max retries exhausted — escalate
        await escalateToOps(bookingId);
        return false;
    }

    // Increment recovery counter
    await prisma.booking.update({
        where: { id: bookingId },
        data: { recoveryAttempts: { increment: 1 } },
    });

    const excludeIds = booking.attempts.map(a => a.providerId);

    // Determine retry strategy based on attempt number
    let provider = null;
    const retryNum = currentAttempts + 1;

    console.log(`🔄 Recovery attempt ${retryNum}/${MAX_RETRY_ATTEMPTS} for booking ${bookingId}`);

    switch (retryNum) {
        case 1:
            // First retry: Same filters as original
            provider = await findBestProvider(excludeIds, booking.tripType as 'HIGH_RELIABILITY' | 'STANDARD');
            break;

        case 2:
            // Second retry: Relaxed to STANDARD filters
            provider = await findBestProvider(excludeIds, 'STANDARD');
            break;

        case 3:
            // Third retry: Any active provider with >50% reliability
            provider = await findBestProvider(excludeIds, 'STANDARD');
            break;

        default:
            break;
    }

    if (provider) {
        // Record successful recovery attempt
        await prisma.bookingAttempt.create({
            data: {
                bookingId,
                providerId: provider.providerId,
                attemptNumber: excludeIds.length + 1,
                success: true,
                score: provider.score,
                reliability: provider.reliability,
                metadata: { recoveryAttempt: retryNum },
            },
        });

        // Update booking state
        await prisma.booking.update({
            where: { id: bookingId },
            data: {
                providerId: provider.providerId,
                state: 'CONFIRMED',
                previousState: booking.state,
                confirmedAt: new Date(),
            },
        });

        // Log recovery
        await prisma.bookingLog.create({
            data: {
                bookingId,
                event: 'RECOVERY_SUCCESS',
                message: `Recovery attempt ${retryNum} succeeded. Provider: ${provider.name}`,
                metadata: {
                    recoveryAttempt: retryNum,
                    providerId: provider.providerId,
                    score: provider.score,
                },
            },
        });

        console.log(`✅ Recovery succeeded on attempt ${retryNum}`);
        return true;
    }

    // Log failed recovery attempt
    await prisma.bookingLog.create({
        data: {
            bookingId,
            event: 'RECOVERY_FAILED',
            message: `Recovery attempt ${retryNum} failed. No eligible provider found.`,
            metadata: { recoveryAttempt: retryNum, excludedProviders: excludeIds },
        },
    });

    // Try next recovery level
    if (retryNum < MAX_RETRY_ATTEMPTS) {
        return attemptRecovery(bookingId);
    }

    // All retries failed
    await escalateToOps(bookingId);
    return false;
}

// ─── Escalation ─────────────────────────────────────────

/**
 * escalateToOps — Flag booking for manual intervention
 * 
 * This is the last resort when automated recovery fails.
 * An ops team member will manually assign a provider.
 */
async function escalateToOps(bookingId: string): Promise<void> {
    await prisma.booking.update({
        where: { id: bookingId },
        data: {
            state: 'MANUAL_ESCALATION',
            previousState: 'FAILED',
            manualIntervention: true,
        },
    });

    await prisma.bookingLog.create({
        data: {
            bookingId,
            event: 'ESCALATED',
            message: 'All recovery attempts exhausted. Escalated to ops team.',
            metadata: {
                escalatedAt: new Date().toISOString(),
                reason: 'max_retries_exhausted',
            },
        },
    });

    console.log(`🚨 Booking ${bookingId} escalated to ops team`);

    // In production: Send Slack/email notification to ops
    // await notifyOpsTeam(bookingId);
}

// ─── Compensation ───────────────────────────────────────

/**
 * issueCompensation — Give ₹100 credit to user for failed booking
 * 
 * Credits are:
 * - ₹100 per failed booking
 * - Valid for 30 days
 * - Can be applied to next booking
 * - Tracked for fraud prevention
 */
export async function issueCompensation(
    userId: string,
    userPhone: string,
    bookingId: string
): Promise<void> {
    // Check if compensation already issued for this booking
    const existing = await prisma.userCredit.findFirst({
        where: {
            userId,
            usedInBookingId: bookingId,
        },
    });

    if (existing) {
        console.log(`⚠️  Compensation already issued for booking ${bookingId}`);
        return;
    }

    // Check daily compensation limit (max 3 per day per user)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCredits = await prisma.userCredit.count({
        where: {
            userId,
            issued: { gte: today, lt: tomorrow },
        },
    });

    if (todayCredits >= 3) {
        console.log(`⚠️  Daily compensation limit reached for user ${userId}`);
        await prisma.bookingLog.create({
            data: {
                bookingId,
                event: 'COMPENSATION_LIMIT',
                message: 'Daily compensation limit reached (3/day)',
            },
        });
        return;
    }

    // Issue the credit
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + COMPENSATION_EXPIRY_DAYS);

    await prisma.userCredit.create({
        data: {
            userId,
            userPhone,
            amount: COMPENSATION_AMOUNT,
            reason: `Compensation for failed booking ${bookingId}`,
            expiresAt,
            usedInBookingId: bookingId,
        },
    });

    await prisma.bookingLog.create({
        data: {
            bookingId,
            event: 'COMPENSATION_ISSUED',
            message: `₹${COMPENSATION_AMOUNT / 100} credit issued to user`,
            metadata: {
                amount: COMPENSATION_AMOUNT,
                expiresAt: expiresAt.toISOString(),
            },
        },
    });

    console.log(`💰 ₹${COMPENSATION_AMOUNT / 100} credit issued to user ${userId} for booking ${bookingId}`);
}

// ─── Check User Credits ─────────────────────────────────

export async function getUserCredits(userId: string) {
    const credits = await prisma.userCredit.findMany({
        where: {
            userId,
            used: false,
            expiresAt: { gt: new Date() },
        },
        orderBy: { expiresAt: 'asc' },
    });

    const totalAvailable = credits.reduce((sum, c) => sum + c.amount, 0);

    return {
        credits,
        totalAvailable,
        totalAvailableRupees: totalAvailable / 100,
    };
}

/**
 * Apply credits to a booking (deduct from user's balance)
 */
export async function applyCredit(
    creditId: string,
    bookingId: string
): Promise<boolean> {
    const credit = await prisma.userCredit.findUnique({
        where: { id: creditId },
    });

    if (!credit || credit.used || credit.expiresAt < new Date()) {
        return false;
    }

    await prisma.userCredit.update({
        where: { id: creditId },
        data: {
            used: true,
            usedAt: new Date(),
            usedInBookingId: bookingId,
        },
    });

    return true;
}
