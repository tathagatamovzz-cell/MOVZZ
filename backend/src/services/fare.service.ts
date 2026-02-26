/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ FARE ESTIMATION SERVICE
 * ═══════════════════════════════════════════════════════════
 *
 *  Mode-specific fare calculation with full breakdowns.
 *  All monetary values stored in PAISE (₹1 = 100 paise)
 *  for precision. Converted to rupees only at the API
 *  response layer.
 *
 *  Supported modes:
 *    CAB        — Economy / Comfort / Premium tiers
 *    BIKE  — Single tier
 *    AUTO       — Single tier
 *    METRO      — Station-based flat fare tiers
 *
 *  Distance: Haversine formula (straight-line).
 *  In production, swap with Google Distance Matrix API
 *  for road-distance accuracy.
 * ═══════════════════════════════════════════════════════════
 */

// ─── Types ──────────────────────────────────────────────

export type TransportMode = 'CAB' | 'BIKE' | 'AUTO' | 'METRO';

export interface FareConfig {
    baseFarePaise: number;      // Fixed base charge
    perKmPaise: number;         // Rate per kilometer
    perMinPaise: number;        // Wait/travel time charge per minute
    minFarePaise: number;       // Floor fare — never charge less than this
    surgeMultiplier: number;    // Dynamic pricing multiplier (1.0 = no surge)
}

export interface FareTier {
    tierId: string;             // e.g. 'cab_economy', 'cab_premium'
    tierName: string;           // e.g. 'Economy', 'Premium'
    tierDescription: string;    // e.g. 'Swift Dzire, Hyundai Aura'
    config: FareConfig;
}

export interface FareBreakdown {
    tierId: string;
    tierName: string;
    tierDescription: string;
    baseFare: number;           // In paise
    distanceKm: number;         // Calculated distance
    distanceCharge: number;     // perKm × distance (paise)
    estimatedDurationMin: number;
    timeCharge: number;         // perMin × duration (paise)
    subtotal: number;           // base + distance + time (paise)
    surgeMultiplier: number;
    surgeCharge: number;        // Additional charge from surge (paise)
    totalFare: number;          // Final fare in paise
    totalFareRupees: number;    // Final fare in rupees (for display)
    minFareApplied: boolean;    // Whether the floor fare kicked in
}

// Metro types and logic live in metro.service.ts (extracted per Phase 1D).
// Re-exported here so existing callers (quotes.controller, tests) don't
// need to update their imports.
export {
    MetroFareBreakdown, MetroLine,
    calculateMetroFare, cheapestMetroFare,
    CHENNAI_METRO_LINES, METRO_FARE_SLABS,
} from './metro.service';

// Import for local use within this file (estimateFares, _testExports)
import {
    calculateMetroFare as _calcMetro,
    cheapestMetroFare as _cheapestMetro,
    CHENNAI_METRO_LINES as _METRO_LINES,
    METRO_FARE_SLABS as _METRO_SLABS,
} from './metro.service';
import type { MetroFareBreakdown as _MetroFareBreakdown } from './metro.service';

export interface FareEstimateResult {
    transportMode: TransportMode;
    distanceKm: number;
    estimatedDurationMin: number;
    fares: FareBreakdown[];             // For CAB/BIKE/AUTO
    metroFares?: _MetroFareBreakdown[];  // For METRO only
    calculatedAt: string;               // ISO timestamp
}

// ─── Fare Rate Tables ───────────────────────────────────

/**
 * Chennai-specific fare rates.
 * Based on market rates from Uber, Ola, Rapido in Chennai (2025-2026).
 *
 * CAB has 3 tiers to give users Best/Cheapest/Premium options.
 * BIKE and AUTO are single-tier since the market doesn't
 * differentiate much within these modes.
 */
const CAB_TIERS: FareTier[] = [
    {
        tierId: 'cab_economy',
        tierName: 'Economy',
        tierDescription: 'Swift Dzire, Hyundai Aura',
        config: {
            baseFarePaise: 5000,        // ₹50
            perKmPaise: 1200,           // ₹12/km
            perMinPaise: 150,           // ₹1.5/min
            minFarePaise: 8000,         // ₹80 minimum
            surgeMultiplier: 1.0,
        },
    },
    {
        tierId: 'cab_comfort',
        tierName: 'Comfort',
        tierDescription: 'Maruti Ciaz, Honda City',
        config: {
            baseFarePaise: 7000,        // ₹70
            perKmPaise: 1500,           // ₹15/km
            perMinPaise: 200,           // ₹2/min
            minFarePaise: 12000,        // ₹120 minimum
            surgeMultiplier: 1.0,
        },
    },
    {
        tierId: 'cab_premium',
        tierName: 'Premium',
        tierDescription: 'Toyota Innova, Mahindra XUV',
        config: {
            baseFarePaise: 10000,       // ₹100
            perKmPaise: 1800,           // ₹18/km
            perMinPaise: 250,           // ₹2.5/min
            minFarePaise: 18000,        // ₹180 minimum
            surgeMultiplier: 1.0,
        },
    },
];

const BIKE_TIERS: FareTier[] = [
    {
        tierId: 'bike_standard',
        tierName: 'Bike Taxi',
        tierDescription: 'Two-wheeler, fastest in traffic',
        config: {
            baseFarePaise: 2000,        // ₹20
            perKmPaise: 700,            // ₹7/km
            perMinPaise: 0,             // No time charge for bikes
            minFarePaise: 3000,         // ₹30 minimum
            surgeMultiplier: 1.0,
        },
    },
];

const AUTO_TIERS: FareTier[] = [
    {
        tierId: 'auto_standard',
        tierName: 'Auto Rickshaw',
        tierDescription: 'Three-wheeler, metered fare',
        config: {
            baseFarePaise: 3000,        // ₹30
            perKmPaise: 1000,           // ₹10/km
            perMinPaise: 100,           // ₹1/min
            minFarePaise: 5000,         // ₹50 minimum
            surgeMultiplier: 1.0,
        },
    },
];

// Metro fare slabs and line data now live in metro.service.ts.
// Imported above as _METRO_SLABS, _METRO_LINES for local use.

// ─── Distance Calculation ───────────────────────────────

/**
 * Haversine formula — calculate straight-line distance between
 * two coordinates in kilometers.
 *
 * Accuracy for Chennai (city-scale): ±5-15% vs road distance.
 * We apply a ROAD_FACTOR multiplier to approximate real road
 * distance from straight-line distance. Chennai's grid layout
 * with arterial roads means road distance is typically 1.3-1.4x
 * the straight-line distance.
 */
const ROAD_FACTOR = 1.35; // Chennai road-to-straight-line ratio

export function calculateDistance(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number
): number {
    const R = 6371; // Earth radius in km
    const dLat = toRad(dropoffLat - pickupLat);
    const dLng = toRad(dropoffLng - pickupLng);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(pickupLat)) * Math.cos(toRad(dropoffLat)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightLine = R * c;

    // Apply road factor for more realistic distance
    return Math.round(straightLine * ROAD_FACTOR * 100) / 100;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

/**
 * Estimate travel duration in minutes based on distance and mode.
 * Uses average speeds for Chennai traffic conditions.
 */
const AVG_SPEEDS_KMPH: Record<TransportMode, number> = {
    CAB: 22,            // Chennai urban average with traffic
    BIKE: 28,      // Bikes weave through traffic faster
    AUTO: 20,           // Autos are slower in congestion
    METRO: 35,          // Metro is fastest but includes walking time
};

export function estimateDuration(distanceKm: number, mode: TransportMode): number {
    const speed = AVG_SPEEDS_KMPH[mode];
    const travelMin = (distanceKm / speed) * 60;
    // Add 3 minutes buffer for pickup wait
    return Math.round(travelMin + 3);
}

// ─── Core Fare Calculator ───────────────────────────────

/**
 * Calculate fare for a single tier given distance and duration.
 * Pure function — no side effects, no DB calls.
 */
export function calculateTierFare(
    tier: FareTier,
    distanceKm: number,
    durationMin: number,
    surgeOverride?: number
): FareBreakdown {
    const config = tier.config;
    const surge = surgeOverride ?? config.surgeMultiplier;

    // Base components
    const baseFare = config.baseFarePaise;
    const distanceCharge = Math.round(distanceKm * config.perKmPaise);
    const timeCharge = Math.round(durationMin * config.perMinPaise);

    // Subtotal before surge
    const subtotal = baseFare + distanceCharge + timeCharge;

    // Surge calculation
    const surgeCharge = surge > 1.0
        ? Math.round(subtotal * (surge - 1.0))
        : 0;

    // Total with surge, subject to minimum fare
    const rawTotal = subtotal + surgeCharge;
    const minFareApplied = rawTotal < config.minFarePaise;
    const totalFare = Math.max(rawTotal, config.minFarePaise);

    return {
        tierId: tier.tierId,
        tierName: tier.tierName,
        tierDescription: tier.tierDescription,
        baseFare,
        distanceKm,
        distanceCharge,
        estimatedDurationMin: durationMin,
        timeCharge,
        subtotal,
        surgeMultiplier: surge,
        surgeCharge,
        totalFare,
        totalFareRupees: totalFare / 100,
        minFareApplied,
    };
}

// Metro fare calculation now lives in metro.service.ts.
// calculateMetroFare is re-exported above and imported as _calcMetro for local use.

// ─── Surge Pricing Engine ───────────────────────────────

/**
 * Determine surge multiplier based on time of day and demand patterns.
 * This is a simplified heuristic — in production, this would use
 * real-time demand/supply ratios.
 *
 * Chennai surge patterns:
 *   - Morning rush (7-10 AM):    1.2-1.5x
 *   - Evening rush (5-9 PM):     1.3-1.6x
 *   - Late night (11 PM-5 AM):   1.2x (low supply)
 *   - Rain/holiday:              1.5-2.0x (not implemented yet)
 *   - Airport (always):          1.1x (high demand zone)
 */
export function getSurgeMultiplier(
    mode: TransportMode,
    hour?: number,
    isAirport?: boolean
): number {
    // Metro has no surge
    if (mode === 'METRO') return 1.0;

    const currentHour = hour ?? new Date().getHours();
    let surge = 1.0;

    // Time-based surge
    if (currentHour >= 7 && currentHour <= 9) {
        surge = 1.2;    // Morning rush
    } else if (currentHour >= 17 && currentHour <= 20) {
        surge = 1.3;    // Evening rush
    } else if (currentHour >= 23 || currentHour <= 5) {
        surge = 1.15;   // Late night
    }

    // Airport premium
    if (isAirport) {
        surge = Math.max(surge, 1.1);
        surge += 0.05;  // Additional airport premium
    }

    // Bikes and autos have lower surge caps
    if (mode === 'BIKE') {
        surge = Math.min(surge, 1.3);  // Cap at 1.3x
    } else if (mode === 'AUTO') {
        surge = Math.min(surge, 1.4);  // Cap at 1.4x
    }
    // CABs can go up to 2.0x (but not in this heuristic)

    return Math.round(surge * 100) / 100;
}

// ─── Airport Detection ──────────────────────────────────

/**
 * Check if either pickup or drop is near Chennai Airport.
 * Airport coords: 12.9941° N, 80.1709° E
 * Threshold: 3 km radius
 */
const AIRPORT_LAT = 12.9941;
const AIRPORT_LNG = 80.1709;
const AIRPORT_RADIUS_KM = 3;

export function isNearAirport(lat?: number, lng?: number): boolean {
    if (!lat || !lng) return false;
    const dist = calculateDistance(lat, lng, AIRPORT_LAT, AIRPORT_LNG) / ROAD_FACTOR; // Use straight-line here
    return dist <= AIRPORT_RADIUS_KM;
}

// ─── Main Fare Estimation Function ──────────────────────

/**
 * estimateFares — The primary entry point for fare calculation.
 *
 * Given a transport mode and coordinates, returns all applicable
 * fare tiers with full breakdowns.
 *
 * For CAB: returns 3 tiers (Economy, Comfort, Premium)
 * For BIKE: returns 1 tier
 * For AUTO: returns 1 tier
 * For METRO: returns metro-specific fare breakdowns per line
 *
 * @param mode - Transport mode
 * @param pickupLat - Pickup latitude
 * @param pickupLng - Pickup longitude
 * @param dropoffLat - Dropoff latitude
 * @param dropoffLng - Dropoff longitude
 * @param surgeOverride - Optional manual surge (for testing)
 */
export function estimateFares(
    mode: TransportMode,
    pickupLat?: number | null,
    pickupLng?: number | null,
    dropoffLat?: number | null,
    dropoffLng?: number | null,
    surgeOverride?: number
): FareEstimateResult {
    // Calculate distance
    let distanceKm: number;

    if (pickupLat && pickupLng && dropoffLat && dropoffLng) {
        distanceKm = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    } else {
        // Default distance when no coordinates provided
        distanceKm = 12; // ~12 km is average Chennai ride
    }

    const durationMin = estimateDuration(distanceKm, mode);

    // Determine surge
    const airportInvolved = isNearAirport(pickupLat ?? undefined, pickupLng ?? undefined)
        || isNearAirport(dropoffLat ?? undefined, dropoffLng ?? undefined);
    const surge = surgeOverride ?? getSurgeMultiplier(mode, undefined, airportInvolved);

    // Select tiers based on mode
    let tiers: FareTier[];
    switch (mode) {
        case 'CAB':
            tiers = CAB_TIERS;
            break;
        case 'BIKE':
            tiers = BIKE_TIERS;
            break;
        case 'AUTO':
            tiers = AUTO_TIERS;
            break;
        case 'METRO':
            // Metro uses a completely different pricing model
            return {
                transportMode: mode,
                distanceKm,
                estimatedDurationMin: durationMin,
                fares: [],
                metroFares: _calcMetro(distanceKm),
                calculatedAt: new Date().toISOString(),
            };
        default:
            tiers = CAB_TIERS; // Fallback
    }

    // Calculate fare for each tier
    const fares = tiers.map(tier =>
        calculateTierFare(tier, distanceKm, durationMin, surge)
    );

    return {
        transportMode: mode,
        distanceKm,
        estimatedDurationMin: durationMin,
        fares,
        calculatedAt: new Date().toISOString(),
    };
}

// ─── Convenience: Single Best Fare ──────────────────────

/**
 * estimateSingleFare — Returns just the cheapest fare for a mode.
 * Used by the booking service when it only needs one number
 * (e.g., for the fareEstimate field on a Booking record).
 *
 * Returns fare in PAISE.
 */
export function estimateSingleFare(
    mode: TransportMode,
    pickupLat?: number | null,
    pickupLng?: number | null,
    dropoffLat?: number | null,
    dropoffLng?: number | null
): number {
    const result = estimateFares(mode, pickupLat, pickupLng, dropoffLat, dropoffLng);

    if (mode === 'METRO' && result.metroFares && result.metroFares.length > 0) {
        // Return cheapest metro option
        return Math.min(...result.metroFares.map(f => f.totalFare));
    }

    if (result.fares.length === 0) {
        return 15000; // ₹150 fallback
    }

    // Return the cheapest tier (first one is usually economy)
    return Math.min(...result.fares.map(f => f.totalFare));
}

// ─── Exports for Testing ────────────────────────────────

export const _testExports = {
    CAB_TIERS,
    BIKE_TIERS,
    AUTO_TIERS,
    METRO_FARE_SLABS: _METRO_SLABS,
    CHENNAI_METRO_LINES: _METRO_LINES,
    ROAD_FACTOR,
    AVG_SPEEDS_KMPH,
};
