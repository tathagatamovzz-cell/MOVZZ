/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ PROVIDER METRICS SERVICE — AI Week 1
 * ═══════════════════════════════════════════════════════════
 *  Aggregates historical performance data for a provider
 *  into a ProviderMetrics object used by predictReliability().
 *
 *  Data sources:
 *    - ProviderMetric table (daily aggregates, last 30 days)
 *    - BookingAttempt table (per-attempt detail for recency windows)
 *
 *  Cache: Redis 5-minute TTL per provider (key: provider:{id}:metrics)
 * ═══════════════════════════════════════════════════════════
 */

import prisma from '../config/database';
import redis  from '../config/redis';
import { ProviderMetrics } from '../types/ai.types';

const CACHE_TTL_SECONDS = 300; // 5 minutes

// ─── getProviderMetrics ───────────────────────────────────

export async function getProviderMetrics(providerId: string): Promise<ProviderMetrics> {
    const cacheKey = `provider:${providerId}:metrics`;

    // Check Redis cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
        try { return JSON.parse(cached) as ProviderMetrics; } catch { /* fall through */ }
    }

    const metrics = await computeMetrics(providerId);

    // Cache result
    await redis.set(cacheKey, JSON.stringify(metrics), CACHE_TTL_SECONDS);

    return metrics;
}

// ─── computeMetrics (internal) ────────────────────────────

async function computeMetrics(providerId: string): Promise<ProviderMetrics> {
    const now    = new Date();
    const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── All attempts in last 30 days ─────────────────────
    const attempts = await prisma.bookingAttempt.findMany({
        where: { providerId, createdAt: { gte: ago30d } },
        select: {
            success:     true,
            createdAt:   true,
            responseTime: true,
            booking: {
                select: {
                    pickupLat:  true,
                    pickupLng:  true,
                    dropoffLat: true,
                    dropoffLng: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    const total = attempts.length;

    // ── Overall success rate ──────────────────────────────
    const overallSuccessRate = total > 0
        ? attempts.filter(a => a.success).length / total
        : 0.85; // default when no data

    // ── Hourly success rates (0–23) ───────────────────────
    const hourlyBuckets: { success: number; total: number }[] = Array.from(
        { length: 24 }, () => ({ success: 0, total: 0 })
    );
    for (const a of attempts) {
        const h = a.createdAt.getHours();
        hourlyBuckets[h].total++;
        if (a.success) hourlyBuckets[h].success++;
    }
    const hourlySuccessRate = hourlyBuckets.map(b =>
        b.total > 0 ? b.success / b.total : overallSuccessRate
    );

    // ── Recency windows ───────────────────────────────────
    const last1hSuccessRate  = windowRate(attempts, now, 1);
    const last6hSuccessRate  = windowRate(attempts, now, 6);
    const last24hSuccessRate = windowRate(attempts, now, 24);
    const last7dSuccessRate  = windowRate(attempts, now, 7 * 24);

    // ── Consecutive streaks (last 10 attempts) ────────────
    const recent10 = attempts.slice(0, 10);
    let consecutiveSuccesses = 0;
    let consecutiveFailures  = 0;
    for (const a of recent10) {
        if (a.success) { consecutiveSuccesses++; consecutiveFailures = 0; }
        else           { consecutiveFailures++;  break; }
    }
    // Reset success count if first failed
    if (recent10.length > 0 && !recent10[0].success) consecutiveSuccesses = 0;

    // ── Average response time ─────────────────────────────
    const withResponseTime = attempts.filter(a => a.responseTime != null);
    const avgResponseTimeMs = withResponseTime.length > 0
        ? withResponseTime.reduce((s, a) => s + (a.responseTime ?? 0), 0) / withResponseTime.length
        : 5000;

    // ── Typical distance range (from booking coords) ──────
    const distances = attempts
        .filter(a => a.booking?.pickupLat && a.booking?.dropoffLat)
        .map(a => haversineKm(
            a.booking!.pickupLat!,  a.booking!.pickupLng!,
            a.booking!.dropoffLat!, a.booking!.dropoffLng!,
        ) * 1.35);
    const typicalDistanceRange: [number, number] = distances.length >= 3
        ? [Math.min(...distances), Math.max(...distances)]
        : [2, 30]; // wide default

    return {
        providerId,
        overallSuccessRate,
        hourlySuccessRate,
        last1hSuccessRate,
        last6hSuccessRate,
        last24hSuccessRate,
        last7dSuccessRate,
        consecutiveSuccesses,
        consecutiveFailures,
        avgResponseTimeMs,
        dominantZones: [],       // Zone tracking added in Week 3 (needs bookingZone field)
        typicalDistanceRange,
    };
}

// ─── Helpers ──────────────────────────────────────────────

function windowRate(
    attempts: { success: boolean; createdAt: Date }[],
    now: Date,
    hours: number,
): number {
    const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const window = attempts.filter(a => a.createdAt >= cutoff);
    if (window.length === 0) return 0.85; // default when no data in window
    return window.filter(a => a.success).length / window.length;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
