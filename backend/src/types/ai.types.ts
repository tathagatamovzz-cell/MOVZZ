/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ AI TYPES — Week 1
 * ═══════════════════════════════════════════════════════════
 *  Shared types for context-aware provider scoring,
 *  orchestration strategies, and failure detection.
 * ═══════════════════════════════════════════════════════════
 */

// ─── Enums ───────────────────────────────────────────────

export enum Zone {
    NORTH_CHENNAI = 'NORTH_CHENNAI',
    SOUTH_CHENNAI = 'SOUTH_CHENNAI',
    CENTRAL       = 'CENTRAL',
    AIRPORT       = 'AIRPORT',
    IT_CORRIDOR   = 'IT_CORRIDOR',
    SUBURBS       = 'SUBURBS',
}

export enum WeatherCondition {
    CLEAR      = 'CLEAR',
    OVERCAST   = 'OVERCAST',
    RAIN       = 'RAIN',
    HEAVY_RAIN = 'HEAVY_RAIN',
    STORM      = 'STORM',
}

export enum TrafficLevel {
    LOW      = 'LOW',
    MODERATE = 'MODERATE',
    HIGH     = 'HIGH',
    JAM      = 'JAM',
}

export enum RideType {
    AIRPORT   = 'AIRPORT',
    CORPORATE = 'CORPORATE',
    PERSONAL  = 'PERSONAL',
}

export enum OrchestrationStrategy {
    SEQUENTIAL = 'SEQUENTIAL',   // topScore > 95 — single best provider
    PARALLEL_2 = 'PARALLEL_2',   // topScore > 85 — race top 2
    PARALLEL_3 = 'PARALLEL_3',   // topScore > 70 — race top 3
    CASCADE    = 'CASCADE',      // topScore > 50 — tiered escalation
    EMERGENCY  = 'EMERGENCY',    // topScore ≤ 50 — all providers simultaneously
}

// ─── Context ─────────────────────────────────────────────

export interface RideContext {
    zone:        Zone;
    distanceKm:  number;
    hour:        number;       // 0–23
    dayOfWeek:   number;       // 0 = Sunday
    isPeakHour:  boolean;      // 7–10 or 17–21
    isWeekend:   boolean;
    rideType:    RideType;
    weather:     WeatherCondition;
    traffic:     TrafficLevel;
    pickupLat?:  number;
    pickupLng?:  number;
}

// ─── Scoring ─────────────────────────────────────────────

export interface ScoreBreakdown {
    base:                number;
    timeAdjustment:      number;   // ±10  — hour-of-day match
    zoneAdjustment:      number;   // ±15  — zone familiarity
    weatherAdjustment:   number;   // ±8   — weather impact
    distanceAdjustment:  number;   // ±5   — distance range fit
    capacityAdjustment:  number;   // ±12  — active ride load
    recentPerfAdjustment: number;  // ±10  — last 6h vs overall
    rideTypeAdjustment:  number;   // ±5   — ride type specialization
    userMatchAdjustment: number;   // ±3   — user preference (Week 4)
}

export interface ReliabilityScore {
    score:      number;     // 0–100
    confidence: number;     // 0–1 (based on data volume)
    reasoning:  string[];   // human-readable explanation per adjustment
    warnings:   string[];   // flags worth showing in admin UI
    breakdown:  ScoreBreakdown;
}

// ─── Provider Metrics ─────────────────────────────────────

export interface ProviderMetrics {
    providerId:           string;
    overallSuccessRate:   number;         // 0–1
    hourlySuccessRate:    number[];       // index = hour 0–23, value = 0–1
    last1hSuccessRate:    number;
    last6hSuccessRate:    number;
    last24hSuccessRate:   number;
    last7dSuccessRate:    number;
    consecutiveSuccesses: number;
    consecutiveFailures:  number;
    avgResponseTimeMs:    number;
    dominantZones:        string[];       // top zones by ride count
    typicalDistanceRange: [number, number]; // [minKm, maxKm]
}
