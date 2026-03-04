/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ CONTEXT BUILDER — AI Week 1
 * ═══════════════════════════════════════════════════════════
 *  Builds a RideContext from booking coordinates.
 *  Context feeds into predictReliability() for each provider.
 *
 *  Chennai zone bounding boxes:
 *    AIRPORT     — within 5km of 12.9941°N, 80.1709°E
 *    IT_CORRIDOR — OMR area: lng > 80.22, lat 12.8–13.0
 *    CENTRAL     — Egmore/T.Nagar: lat 13.05–13.08, lng 80.25–80.28
 *    NORTH       — lat > 13.08
 *    SOUTH       — lat < 12.90
 *    SUBURBS     — everything else
 *
 *  Weather + traffic: mocked CLEAR + MODERATE for Week 1.
 *  Real API integration planned for Week 3.
 * ═══════════════════════════════════════════════════════════
 */

import {
    Zone,
    WeatherCondition,
    TrafficLevel,
    RideType,
    RideContext,
} from '../types/ai.types';

// ─── Airport coords (Chennai International) ──────────────
const AIRPORT_LAT = 12.9941;
const AIRPORT_LNG = 80.1709;
const AIRPORT_RADIUS_KM = 5;

// ─── Haversine distance (km) ─────────────────────────────
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

// ─── Zone detection ───────────────────────────────────────
function detectZone(lat?: number, lng?: number): Zone {
    if (lat == null || lng == null) return Zone.SUBURBS;

    // Airport: within 5km of terminal
    if (haversineKm(lat, lng, AIRPORT_LAT, AIRPORT_LNG) <= AIRPORT_RADIUS_KM) {
        return Zone.AIRPORT;
    }

    // IT Corridor: OMR / Sholinganallur / Perungudi
    if (lng > 80.22 && lat >= 12.80 && lat <= 13.0) {
        return Zone.IT_CORRIDOR;
    }

    // Central: Egmore / T.Nagar / Nungambakkam
    if (lat >= 13.05 && lat <= 13.08 && lng >= 80.25 && lng <= 80.28) {
        return Zone.CENTRAL;
    }

    // North Chennai
    if (lat > 13.08) return Zone.NORTH_CHENNAI;

    // South Chennai
    if (lat < 12.90) return Zone.SOUTH_CHENNAI;

    return Zone.SUBURBS;
}

// ─── buildRideContext ─────────────────────────────────────

export function buildRideContext(params: {
    pickupLat?:  number;
    pickupLng?:  number;
    dropoffLat?: number;
    dropoffLng?: number;
    transportMode?: string;
}): RideContext {
    const now       = new Date();
    const hour      = now.getHours();
    const dayOfWeek = now.getDay();

    const zone = detectZone(params.pickupLat, params.pickupLng);

    // Road distance estimate: Haversine × 1.35 road factor (same as fare.service.ts)
    let distanceKm = 5; // default when coords unavailable
    if (
        params.pickupLat != null && params.pickupLng != null &&
        params.dropoffLat != null && params.dropoffLng != null
    ) {
        distanceKm = haversineKm(
            params.pickupLat, params.pickupLng,
            params.dropoffLat, params.dropoffLng,
        ) * 1.35;
    }

    const isPeakHour = (hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 21);
    const isWeekend  = dayOfWeek === 0 || dayOfWeek === 6;
    const rideType   = zone === Zone.AIRPORT ? RideType.AIRPORT : RideType.PERSONAL;

    return {
        zone,
        distanceKm: Math.round(distanceKm * 100) / 100,
        hour,
        dayOfWeek,
        isPeakHour,
        isWeekend,
        rideType,
        // Week 1: mock weather + traffic; real API in Week 3
        weather: WeatherCondition.CLEAR,
        traffic: TrafficLevel.MODERATE,
        pickupLat: params.pickupLat,
        pickupLng: params.pickupLng,
    };
}
