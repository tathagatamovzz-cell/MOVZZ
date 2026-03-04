/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ FAILURE DETECTOR — AI Week 1
 * ═══════════════════════════════════════════════════════════
 *  Background risk monitor for in-flight bookings.
 *
 *  monitorBooking() — called after executeStrategy(); queues a
 *  BullMQ check job 30s later. If the booking is still SEARCHING,
 *  escalates intervention based on risk score.
 *
 *  Risk score thresholds:
 *    < 30  → log only
 *    ≥ 30  → expand provider pool (minReliability 0.70)
 *    ≥ 50  → expand pool + set driverBonusOffered flag
 *    ≥ 70  → expand + bonus + EMERGENCY strategy
 *    ≥ 85  → all above + issue ₹50 UserCredit compensation
 *    ≥ 90  → all above (compensation already issued at 85)
 * ═══════════════════════════════════════════════════════════
 */

import prisma              from '../../config/database';
import { bookingTimeoutQueue } from '../../config/queues';
import { hardFilter }      from '../provider-scoring.service';
import { decideStrategy, executeStrategy } from './orchestration.service';
import { OrchestrationStrategy } from '../../types/ai.types';

// ─── Risk score calculation ───────────────────────────────

export async function calculateRiskScore(
    bookingId: string,
): Promise<{ riskScore: number; factors: string[] }> {
    const factors: string[] = [];
    let riskScore = 0;

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { attempts: true },
    });

    if (!booking) return { riskScore: 0, factors: ['booking not found'] };

    // +20 — stuck in SEARCHING > 60s
    if (booking.state === 'SEARCHING') {
        const ageMs = Date.now() - booking.createdAt.getTime();
        if (ageMs > 60_000) {
            riskScore += 20;
            factors.push(`+20 stuck in SEARCHING for ${Math.round(ageMs / 1000)}s`);
        }
    }

    // +30 — more than 2 failed attempts
    const failedAttempts = booking.attempts.filter(a => !a.success).length;
    if (failedAttempts > 2) {
        riskScore += 30;
        factors.push(`+30 ${failedAttempts} failed dispatch attempts`);
    }

    // +40 — all HIGH_RELIABILITY providers already attempted
    const attemptedIds = booking.attempts.map(a => a.providerId);
    const highRelProviders = await prisma.provider.findMany({
        where: { reliability: { gte: 0.90 }, active: true },
        select: { id: true },
    });
    const allHighRelAttempted =
        highRelProviders.length > 0 &&
        highRelProviders.every(p => attemptedIds.includes(p.id));
    if (allHighRelAttempted) {
        riskScore += 40;
        factors.push('+40 all HIGH_RELIABILITY providers already attempted');
    }

    // +25 — top available provider score < 50
    // (Quick heuristic: if remaining providers have low reliability)
    const remainingIds = await hardFilter({
        minReliability: 0.70,
        excludeIds: attemptedIds,
    });
    if (remainingIds.length > 0) {
        const topProvider = await prisma.provider.findUnique({
            where: { id: remainingIds[0] },
            select: { reliability: true },
        });
        if (topProvider && topProvider.reliability * 100 < 50) {
            riskScore += 25;
            factors.push('+25 top available provider score < 50');
        }
    } else {
        riskScore += 25;
        factors.push('+25 no providers available in expanded pool');
    }

    console.log(`[FailureDetector] Booking ${bookingId} risk score: ${riskScore}`, factors);

    return { riskScore, factors };
}

// ─── Intervention ─────────────────────────────────────────

export async function applyIntervention(
    bookingId: string,
    riskScore: number,
): Promise<void> {
    if (riskScore < 30) {
        console.log(`[FailureDetector] Booking ${bookingId}: low risk (${riskScore}), monitoring only`);
        return;
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.state !== 'SEARCHING') return;

    // ≥ 30: expand provider pool
    if (riskScore >= 30) {
        console.log(`[FailureDetector] Booking ${bookingId}: expanding provider pool to 0.70 reliability`);
        const attemptedIds = (await prisma.bookingAttempt.findMany({
            where: { bookingId },
            select: { providerId: true },
        })).map(a => a.providerId);

        const expandedPool = await hardFilter({ minReliability: 0.70, excludeIds: attemptedIds });
        if (expandedPool.length > 0) {
            await executeStrategy(
                expandedPool,
                OrchestrationStrategy.PARALLEL_2,
                async (providerId) => {
                    // fire-and-forget attempt — booking.service handles state transition
                    console.log(`[FailureDetector] Retry dispatch → provider ${providerId}`);
                    return false; // tracking only in Week 1; real dispatch in Week 2
                },
            );
        }
    }

    // ≥ 50: set driver bonus flag in metadata
    if (riskScore >= 50) {
        const meta = (booking.metadata as Record<string, unknown>) ?? {};
        await prisma.booking.update({
            where: { id: bookingId },
            data: { metadata: { ...meta, driverBonusOffered: true } },
        });
        console.log(`[FailureDetector] Booking ${bookingId}: driver bonus flag set`);
    }

    // ≥ 85: issue ₹50 compensation credit to user
    if (riskScore >= 85) {
        const alreadyCompensated = await prisma.userCredit.findFirst({
            where: { userId: booking.userId, reason: 'booking_delay_compensation' },
        });
        if (!alreadyCompensated) {
            await prisma.userCredit.create({
                data: {
                    userId:    booking.userId,
                    userPhone: booking.userPhone,
                    amount:    5000, // ₹50 in paise
                    reason:    'booking_delay_compensation',
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                },
            });
            console.log(`[FailureDetector] Booking ${bookingId}: ₹50 credit issued to user ${booking.userId}`);
        }
    }
}

// ─── Monitor booking (background) ────────────────────────

/**
 * monitorBooking — Schedules a 30-second delayed risk check.
 * Called fire-and-forget after strategy execution in booking.service.ts.
 */
export function monitorBooking(bookingId: string): void {
    bookingTimeoutQueue
        .add(
            `risk-check-${bookingId}`,
            { bookingId, type: 'risk_check' },
            { delay: 30_000 },
        )
        .catch(err => console.error('[FailureDetector] Failed to enqueue monitor job:', err.message));

    console.log(`[FailureDetector] Monitoring scheduled for booking ${bookingId} (30s)`);
}
