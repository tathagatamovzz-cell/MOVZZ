/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ PROVIDER SCORING SERVICE — "The Brain"
 * ═══════════════════════════════════════════════════════════
 * 
 *  This is the core intelligence engine that decides which
 *  driver/provider gets assigned to a booking. It uses a
 *  multi-factor scoring algorithm:
 * 
 *  1. hardFilter()      → Reject providers below thresholds
 *  2. scoreProvider()    → Rank providers by weighted formula
 *  3. findBestProvider() → Return the highest scoring match
 * ═══════════════════════════════════════════════════════════
 */

import prisma from '../config/database';
import { Provider } from '@prisma/client';
import {
    RideContext,
    ProviderMetrics,
    ReliabilityScore,
    ScoreBreakdown,
    Zone,
    WeatherCondition,
    RideType,
} from '../types/ai.types';

// ─── Types ──────────────────────────────────────────────

export interface ScoringWeights {
    reliability: number;    // Weight for reliability score (0-1)
    rating: number;         // Weight for user rating (0-1)
    proximity: number;      // Weight for distance/ETA (0-1)
    completionRate: number; // Weight for ride completion rate (0-1)
    recency: number;        // Weight for recent activity (0-1)
}

export interface ScoredProvider {
    providerId: string;
    name: string;
    phone: string;
    score: number;
    reliability: number;
    rating: number;
    eta: number | null;
    fare: number | null;
    breakdown: {
        reliabilityScore: number;
        ratingScore: number;
        completionScore: number;
        recencyScore: number;
        proximityScore: number;
    };
}

export interface FilterCriteria {
    minReliability: number;
    minRating: number;
    minTotalRides: number;
    excludeIds: string[];
    requireActive: boolean;
}

// ─── Default Configs ────────────────────────────────────

const DEFAULT_WEIGHTS: ScoringWeights = {
    reliability: 0.35,
    rating: 0.20,
    proximity: 0.15,
    completionRate: 0.20,
    recency: 0.10,
};

const DEFAULT_FILTER: FilterCriteria = {
    minReliability: 0.90,  // 90% minimum reliability
    minRating: 3.5,
    minTotalRides: 0,      // No minimum for new providers
    excludeIds: [],
    requireActive: true,
};

// ─── Hard Filter ────────────────────────────────────────

/**
 * hardFilter — Reject providers that don't meet minimum thresholds
 * 
 * This is the FIRST pass. Any provider that fails ANY of these
 * criteria is immediately disqualified:
 * - Reliability < 90%
 * - Rating < 3.5
 * - Not active
 * - Currently paused
 * - Previously rejected for this booking
 */
export async function hardFilter(
    criteria: Partial<FilterCriteria> = {}
): Promise<string[]> {
    const filter = { ...DEFAULT_FILTER, ...criteria };

    const providers = await prisma.provider.findMany({
        where: {
            active: filter.requireActive ? true : undefined,
            reliability: { gte: filter.minReliability },
            rating: { gte: filter.minRating },
            totalRides: { gte: filter.minTotalRides },
            id: filter.excludeIds.length > 0
                ? { notIn: filter.excludeIds }
                : undefined,
            OR: [
                { pausedUntil: null },
                { pausedUntil: { lt: new Date() } },
            ],
        },
        select: { id: true },
    });

    return providers.map(p => p.id);
}

// ─── Score Provider ─────────────────────────────────────

/**
 * scoreProvider — Calculate a composite score for a single provider
 * 
 * Formula:
 *   totalScore = Σ(weight_i * normalizedScore_i)
 * 
 * Each factor is normalized to 0-100 scale before weighting.
 */
export async function scoreProvider(
    providerId: string,
    weights: Partial<ScoringWeights> = {}
): Promise<ScoredProvider | null> {
    const w = { ...DEFAULT_WEIGHTS, ...weights };

    const provider = await prisma.provider.findUnique({
        where: { id: providerId },
        include: {
            metrics: {
                orderBy: { date: 'desc' },
                take: 7,  // Last 7 days of metrics
            },
        },
    });

    if (!provider) return null;

    // 1. Reliability Score (0-100)
    const reliabilityScore = provider.reliability * 100;

    // 2. Rating Score (0-100, normalized from 1-5 scale)
    const ratingScore = ((provider.rating - 1) / 4) * 100;

    // 3. Completion Rate Score (0-100)
    const completionRate = provider.totalRides > 0
        ? (provider.successfulRides / provider.totalRides) * 100
        : 50; // Default 50% for new providers

    // 4. Recency Score (0-100) — How recently they were active
    let recencyScore = 0;
    if (provider.lastActiveAt) {
        const hoursSinceActive = (Date.now() - provider.lastActiveAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceActive < 1) recencyScore = 100;
        else if (hoursSinceActive < 6) recencyScore = 80;
        else if (hoursSinceActive < 24) recencyScore = 60;
        else if (hoursSinceActive < 72) recencyScore = 30;
        else recencyScore = 10;
    }

    // 5. Proximity Score (0-100) — Placeholder until GPS integration
    const proximityScore = 70; // Default until real location data

    // ─── Weighted Total ───────────────────────────────────
    const totalScore =
        w.reliability * reliabilityScore +
        w.rating * ratingScore +
        w.completionRate * completionRate +
        w.recency * recencyScore +
        w.proximity * proximityScore;

    return {
        providerId: provider.id,
        name: provider.name,
        phone: provider.phone,
        score: Math.round(totalScore * 100) / 100,
        reliability: provider.reliability,
        rating: provider.rating,
        eta: null, // Will come from GPS later
        fare: null,
        breakdown: {
            reliabilityScore: Math.round(reliabilityScore * 100) / 100,
            ratingScore: Math.round(ratingScore * 100) / 100,
            completionScore: Math.round(completionRate * 100) / 100,
            recencyScore,
            proximityScore,
        },
    };
}

// ─── Find Best Provider ─────────────────────────────────

/**
 * findBestProvider — Return the single best provider for a booking
 * 
 * Pipeline:
 *   1. hardFilter() — Get eligible provider IDs
 *   2. scoreProvider() for each — Calculate scores
 *   3. Sort by score descending
 *   4. Return the top scorer
 * 
 * @param excludeIds - Provider IDs to exclude (already attempted)
 * @param tripType - HIGH_RELIABILITY uses stricter filters
 */
export async function findBestProvider(
    excludeIds: string[] = [],
    tripType: 'HIGH_RELIABILITY' | 'STANDARD' = 'HIGH_RELIABILITY'
): Promise<ScoredProvider | null> {
    // Step 1: Adjust filter based on trip type
    const filterCriteria: Partial<FilterCriteria> = {
        excludeIds,
        minReliability: tripType === 'HIGH_RELIABILITY' ? 0.90 : 0.70,
        minRating: tripType === 'HIGH_RELIABILITY' ? 4.0 : 3.0,
    };

    // Step 2: Get eligible providers
    const eligibleIds = await hardFilter(filterCriteria);

    if (eligibleIds.length === 0) {
        console.log('⚠️  No providers passed hard filter');
        return null;
    }

    console.log(`✅ ${eligibleIds.length} providers passed hard filter`);

    // Step 3: Score all eligible providers
    const scoredProviders: ScoredProvider[] = [];

    for (const id of eligibleIds) {
        const scored = await scoreProvider(id);
        if (scored) {
            scoredProviders.push(scored);
        }
    }

    if (scoredProviders.length === 0) {
        return null;
    }

    // Step 4: Sort by score (descending) and return top
    scoredProviders.sort((a, b) => b.score - a.score);

    const best = scoredProviders[0];
    console.log(`🏆 Best provider: ${best.name} (score: ${best.score})`);

    return best;
}

/**
 * findTopProviders — Return the top N providers sorted by score
 * Useful for showing multiple options or for retry logic
 */
export async function findTopProviders(
    count: number = 3,
    excludeIds: string[] = [],
    tripType: 'HIGH_RELIABILITY' | 'STANDARD' = 'HIGH_RELIABILITY'
): Promise<ScoredProvider[]> {
    const filterCriteria: Partial<FilterCriteria> = {
        excludeIds,
        minReliability: tripType === 'HIGH_RELIABILITY' ? 0.90 : 0.70,
        minRating: tripType === 'HIGH_RELIABILITY' ? 4.0 : 3.0,
    };

    const eligibleIds = await hardFilter(filterCriteria);

    const scoredProviders: ScoredProvider[] = [];
    for (const id of eligibleIds) {
        const scored = await scoreProvider(id);
        if (scored) scoredProviders.push(scored);
    }

    scoredProviders.sort((a, b) => b.score - a.score);

    return scoredProviders.slice(0, count);
}

// ─── AI: predictReliability ──────────────────────────────

/**
 * predictReliability — Context-aware reliability prediction (AI Week 1)
 *
 * Extends the static base score with 8 contextual adjustments:
 *   time, zone, weather, distance, capacity, recent perf,
 *   ride type, user match.
 *
 * All existing functions above are unchanged — this runs in parallel
 * alongside the legacy path until AI-8 wires it as the primary path.
 */
export function predictReliability(
    provider: Provider,
    context: RideContext,
    metrics: ProviderMetrics,
): ReliabilityScore {
    const reasoning: string[] = [];
    const warnings:  string[] = [];

    // Base: provider historical reliability (0–100)
    const base = provider.reliability * 100;

    // ── 1. Time adjustment (±10) ──────────────────────────
    const hourRate = metrics.hourlySuccessRate[context.hour] ?? metrics.overallSuccessRate;
    const timeRaw  = (hourRate - metrics.overallSuccessRate) * 100;
    const timeAdjustment = clamp(timeRaw, -10, 10);
    if (timeAdjustment !== 0) {
        reasoning.push(
            `${timeAdjustment > 0 ? '+' : ''}${timeAdjustment.toFixed(1)} time: ` +
            `${(hourRate * 100).toFixed(0)}% success at hour ${context.hour} ` +
            `vs ${(metrics.overallSuccessRate * 100).toFixed(0)}% overall`
        );
    }

    // ── 2. Zone adjustment (±15) ──────────────────────────
    let zoneAdjustment = 0;
    if (metrics.dominantZones.includes(context.zone)) {
        zoneAdjustment = 15;
        reasoning.push(`+15 zone: provider specialises in ${context.zone}`);
    } else if (metrics.dominantZones.length > 0 && !metrics.dominantZones.includes(context.zone)) {
        // Only penalise if we actually have zone data and it doesn't match
        zoneAdjustment = -8;
        reasoning.push(`-8 zone: provider primarily serves ${metrics.dominantZones[0]}, not ${context.zone}`);
    }

    // ── 3. Weather adjustment (±8) ────────────────────────
    let weatherAdjustment = 0;
    if (context.weather === WeatherCondition.RAIN) {
        weatherAdjustment = -5;
        reasoning.push('-5 weather: rain reduces acceptance rates');
    } else if (context.weather === WeatherCondition.HEAVY_RAIN) {
        weatherAdjustment = -8;
        warnings.push('Heavy rain — significant reliability drop expected');
        reasoning.push('-8 weather: heavy rain');
    } else if (context.weather === WeatherCondition.STORM) {
        weatherAdjustment = -8;
        warnings.push('Storm conditions — consider manual escalation');
        reasoning.push('-8 weather: storm');
    }

    // ── 4. Distance adjustment (±5) ───────────────────────
    let distanceAdjustment = 0;
    const [minDist, maxDist] = metrics.typicalDistanceRange;
    if (context.distanceKm < minDist - 2 || context.distanceKm > maxDist + 2) {
        distanceAdjustment = -5;
        reasoning.push(
            `-5 distance: ${context.distanceKm.toFixed(1)}km outside provider's typical ` +
            `${minDist.toFixed(1)}–${maxDist.toFixed(1)}km range`
        );
    }

    // ── 5. Capacity adjustment (±12) — placeholder ────────
    // Real value wired in AI-7 (currentActiveRides / maxCapacity on Provider model)
    const capacityAdjustment = 0;

    // ── 6. Recent performance adjustment (±10) ───────────
    const recentVsOverall = metrics.last6hSuccessRate - metrics.overallSuccessRate;
    const recentPerfAdjustment = clamp(recentVsOverall * 100, -10, 10);
    if (Math.abs(recentPerfAdjustment) >= 2) {
        reasoning.push(
            `${recentPerfAdjustment > 0 ? '+' : ''}${recentPerfAdjustment.toFixed(1)} recency: ` +
            `${(metrics.last6hSuccessRate * 100).toFixed(0)}% last 6h vs ` +
            `${(metrics.overallSuccessRate * 100).toFixed(0)}% overall`
        );
    }
    if (metrics.consecutiveFailures >= 3) {
        warnings.push(`${metrics.consecutiveFailures} consecutive failures — provider may be unavailable`);
    }

    // ── 7. Ride type adjustment (±5) ─────────────────────
    let rideTypeAdjustment = 0;
    if (context.rideType === RideType.AIRPORT && metrics.dominantZones.includes(Zone.AIRPORT)) {
        rideTypeAdjustment = 5;
        reasoning.push('+5 ride type: provider specialises in airport rides');
    }

    // ── 8. User match adjustment (±3) — Week 4 refines ───
    const userMatchAdjustment = 3; // default positive until personalisation is built

    // ── Final score ───────────────────────────────────────
    const raw = base + timeAdjustment + zoneAdjustment + weatherAdjustment +
                distanceAdjustment + capacityAdjustment + recentPerfAdjustment +
                rideTypeAdjustment + userMatchAdjustment;
    const score = clamp(Math.round(raw * 10) / 10, 0, 100);

    // ── Confidence (based on data volume) ────────────────
    const attemptCount = metrics.overallSuccessRate > 0
        ? metrics.consecutiveSuccesses + metrics.consecutiveFailures
        : 0;
    const confidence = attemptCount > 50 ? 1.0 : attemptCount > 10 ? 0.7 : 0.5;

    const breakdown: ScoreBreakdown = {
        base,
        timeAdjustment,
        zoneAdjustment,
        weatherAdjustment,
        distanceAdjustment,
        capacityAdjustment,
        recentPerfAdjustment,
        rideTypeAdjustment,
        userMatchAdjustment,
    };

    return { score, confidence, reasoning, warnings, breakdown };
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
