/**
 * ═══════════════════════════════════════════════════════════
 *  NIGHTLY AGGREGATION WORKER — AI Week 2
 * ═══════════════════════════════════════════════════════════
 *  Runs at midnight via BullMQ CRON. For each active provider:
 *   1. Aggregates yesterday's booking outcomes
 *   2. Upserts a ProviderMetric row with computed rates
 *   3. Invalidates Redis cache so next request recomputes
 *
 *  Triggered by:  index.ts (schedules CRON on startup)
 * ═══════════════════════════════════════════════════════════
 */

import { Worker } from 'bullmq';
import { connection } from '../config/queues';
import prisma from '../config/database';
import { invalidateProviderScores } from '../services/ai/cache.service';

new Worker('nightly-aggregation', async () => {
    console.log('[NightlyAgg] Starting nightly provider metric aggregation...');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const providers = await prisma.provider.findMany({
        where: { active: true },
        select: { id: true, name: true },
    });

    let updated = 0;

    for (const provider of providers) {
        const bookings = await prisma.booking.findMany({
            where: {
                providerId: provider.id,
                createdAt: { gte: yesterday, lt: today },
            },
            select: {
                state: true,
                fareEstimate: true,
                commissionRate: true,
                timeToConfirm: true,
            },
        });

        if (bookings.length === 0) continue;

        const total       = bookings.length;
        const successful  = bookings.filter(b => b.state === 'COMPLETED').length;
        const cancelled   = bookings.filter(b => b.state === 'CANCELLED').length;
        const failed      = bookings.filter(b => b.state === 'FAILED').length;
        const reliabilityScore = total > 0 ? successful / total : 0;

        const totalRevenue = bookings
            .filter(b => b.state === 'COMPLETED')
            .reduce((sum, b) => sum + b.fareEstimate, 0);

        const totalCommission = Math.round(
            bookings
                .filter(b => b.state === 'COMPLETED')
                .reduce((sum, b) => sum + b.fareEstimate * b.commissionRate, 0)
        );

        const confirmTimes = bookings
            .filter(b => b.timeToConfirm != null)
            .map(b => b.timeToConfirm as number);

        const avgResponseTime = confirmTimes.length > 0
            ? Math.round(confirmTimes.reduce((a, b) => a + b, 0) / confirmTimes.length)
            : null;

        await prisma.providerMetric.upsert({
            where: { providerId_date: { providerId: provider.id, date: yesterday } },
            create: {
                providerId: provider.id,
                date: yesterday,
                totalBookings: total,
                successfulBookings: successful,
                cancelledBookings: cancelled,
                failedBookings: failed,
                reliabilityScore,
                avgResponseTime,
                totalRevenue,
                totalCommission,
            },
            update: {
                totalBookings: total,
                successfulBookings: successful,
                cancelledBookings: cancelled,
                failedBookings: failed,
                reliabilityScore,
                avgResponseTime,
                totalRevenue,
                totalCommission,
            },
        });

        // Update provider's overall reliability (rolling — 90% old + 10% new day)
        await prisma.provider.update({
            where: { id: provider.id },
            data: {
                reliability: { multiply: 0.9 },   // decay old weight
            },
        });
        await prisma.provider.update({
            where: { id: provider.id },
            data: {
                reliability: { increment: reliabilityScore * 0.1 },
            },
        });

        await invalidateProviderScores(provider.id);
        updated++;
    }

    console.log(`[NightlyAgg] Done. Updated ${updated}/${providers.length} providers.`);

}, { connection, concurrency: 1 });

console.log('[Worker] nightly-aggregation worker started');
