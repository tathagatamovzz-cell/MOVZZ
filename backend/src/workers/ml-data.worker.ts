/**
 * ═══════════════════════════════════════════════════════════
 *  ML DATA COLLECTION WORKER — AI Week 2
 * ═══════════════════════════════════════════════════════════
 *  Triggered after every COMPLETED / FAILED / CANCELLED booking
 *  via the ml-data-collection queue. Writes a MLTrainingData
 *  row capturing the full context + outcome for future ML models.
 *
 *  Job data: { bookingId: string }
 * ═══════════════════════════════════════════════════════════
 */

import { Worker } from 'bullmq';
import { connection } from '../config/queues';
import prisma from '../config/database';
import { invalidateProviderScores } from '../services/ai/cache.service';

new Worker('ml-data-collection', async (job) => {
    const { bookingId } = job.data as { bookingId: string };

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
            id: true,
            providerId: true,
            transportMode: true,
            state: true,
            fareEstimate: true,
            pickupLat: true,
            pickupLng: true,
            dropoffLat: true,
            dropoffLng: true,
            timeToConfirm: true,
            orchestrationStrategy: true,
            aiReliabilityScore: true,
            contextSnapshot: true,
            createdAt: true,
        },
    });

    if (!booking || !booking.providerId) return;

    // Skip non-terminal states
    const terminal = ['COMPLETED', 'FAILED', 'CANCELLED'];
    if (!terminal.includes(booking.state)) return;

    // Avoid duplicate entries
    const existing = await prisma.mLTrainingData.findUnique({
        where: { bookingId },
    });
    if (existing) return;

    // Compute distance if coordinates available
    let distanceKm: number | null = null;
    if (booking.pickupLat && booking.pickupLng && booking.dropoffLat && booking.dropoffLng) {
        const R = 6371;
        const dLat = (booking.dropoffLat - booking.pickupLat) * Math.PI / 180;
        const dLng = (booking.dropoffLng - booking.pickupLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(booking.pickupLat * Math.PI / 180) *
            Math.cos(booking.dropoffLat * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
        distanceKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.35 * 10) / 10;
    }

    const now = booking.createdAt;
    await prisma.mLTrainingData.create({
        data: {
            bookingId: booking.id,
            providerId: booking.providerId,
            transportMode: booking.transportMode,
            distanceKm,
            hourOfDay: now.getHours(),
            dayOfWeek: now.getDay(),
            predictedScore: booking.aiReliabilityScore,
            actualOutcome: booking.state,
            timeToConfirmSec: booking.timeToConfirm,
            orchestrationStrategy: booking.orchestrationStrategy,
            contextSnapshot: booking.contextSnapshot ?? undefined,
        },
    });

    // Invalidate provider cache so next score reflects latest outcome
    await invalidateProviderScores(booking.providerId);

    console.log(`[MLData] Recorded outcome for booking ${bookingId}: ${booking.state}`);

}, { connection, concurrency: 10 });

console.log('[Worker] ml-data-collection worker started');
