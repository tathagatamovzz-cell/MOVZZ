/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ METRO SERVICE
 * ═══════════════════════════════════════════════════════════
 *
 *  Chennai Metro-specific fare calculation and line data.
 *  Extracted from fare.service.ts per the integration
 *  roadmap (Phase 1D).
 *
 *  Metro bypasses the provider scoring engine entirely —
 *  there are no drivers to score. Fares are flat-rate
 *  station slabs based on CMRL published rates.
 *
 *  fare.service.ts re-exports from here so existing
 *  callers don't need to change their imports.
 * ═══════════════════════════════════════════════════════════
 */

// ─── Types ──────────────────────────────────────────────

export interface MetroLine {
    lineId: string;
    name: string;
    color: string;
    stations: string[];
    avgInterStationMin: number;
}

export interface MetroFareBreakdown {
    tierId: string;
    tierName: string;
    tierDescription: string;
    line: string;
    stationCount: number;
    totalFare: number;          // In paise
    totalFareRupees: number;
    estimatedDurationMin: number;
}

// ─── Chennai Metro Lines ─────────────────────────────────
// Source: CMRL (Chennai Metro Rail Limited) published data.
// Blue Line: Airport ↔ Wimco Nagar
// Green Line: St. Thomas Mount ↔ Central

export const CHENNAI_METRO_LINES: MetroLine[] = [
    {
        lineId: 'blue',
        name: 'Blue Line',
        color: '#1565C0',
        avgInterStationMin: 2.5,
        stations: [
            'Wimco Nagar', 'Wimco Nagar Depot', 'Tiruvottiyur',
            'Tiruvottiyur Theradi', 'Washermanpet', 'Sir Theagaraya College',
            'Tondiarpet', 'New Washermanpet', 'Government Estate',
            'High Court', 'Mannadi', 'Chennai Central', 'Egmore',
            'Nehru Park', 'Kilpauk', 'Pachaiyappas College',
            'Shenoy Nagar', 'Anna Nagar East', 'Anna Nagar Tower',
            'Thirumangalam', 'Koyambedu', 'CMBT', 'Arumbakkam',
            'Vadapalani', 'Ashok Nagar', 'Ekkattuthangal',
            'Alandur', 'Nanganallur Road', 'Meenambakkam',
            'Chennai Airport',
        ],
    },
    {
        lineId: 'green',
        name: 'Green Line',
        color: '#2E7D32',
        avgInterStationMin: 2.3,
        stations: [
            'Central', 'Government Estate', 'Thousand Lights',
            'AG-DMS', 'Teynampet', 'Nandanam', 'Saidapet',
            'Little Mount', 'Guindy', 'Alandur',
            'Nanganallur Road', 'St. Thomas Mount',
        ],
    },
];

// ─── Fare Slabs ──────────────────────────────────────────
// CMRL flat-rate fare table by station count (2025-2026).

export const METRO_FARE_SLABS: { maxStations: number; farePaise: number }[] = [
    { maxStations: 2,   farePaise: 1000 },  // ₹10
    { maxStations: 5,   farePaise: 2000 },  // ₹20
    { maxStations: 10,  farePaise: 3000 },  // ₹30
    { maxStations: 15,  farePaise: 4000 },  // ₹40
    { maxStations: 25,  farePaise: 5000 },  // ₹50
    { maxStations: 999, farePaise: 6000 },  // ₹60 (beyond 25 stations)
];

// ─── Metro Fare Calculator ───────────────────────────────

/**
 * Calculate metro fares for both lines given a road-adjusted
 * distance. Uses average inter-station distance (1.2 km) to
 * estimate station count, then looks up the fare slab.
 *
 * Returns one entry per metro line. The caller (quotes.controller)
 * presents both options to the user.
 *
 * @param distanceKm - Road-adjusted distance from fare.service.ts
 */
export function calculateMetroFare(
    distanceKm: number
): MetroFareBreakdown[] {
    const AVG_STATION_GAP_KM = 1.2;
    const estimatedStations = Math.max(1, Math.round(distanceKm / AVG_STATION_GAP_KM));

    const results: MetroFareBreakdown[] = [];

    for (const line of CHENNAI_METRO_LINES) {
        const maxLineStations = line.stations.length;
        const stationCount = Math.min(estimatedStations, maxLineStations);

        const slab = METRO_FARE_SLABS.find(s => stationCount <= s.maxStations);
        if (!slab) continue;

        const durationMin = Math.round(stationCount * line.avgInterStationMin) + 5;

        results.push({
            tierId: `metro_${line.lineId}`,
            tierName: line.name,
            tierDescription: `${stationCount} stations, ${
                line.color === '#1565C0'
                    ? 'Airport to Wimco Nagar'
                    : 'St. Thomas Mount to Central'
            }`,
            line: line.name,
            stationCount,
            totalFare: slab.farePaise,
            totalFareRupees: slab.farePaise / 100,
            estimatedDurationMin: durationMin,
        });
    }

    return results;
}

/**
 * Find the cheapest metro fare for a given distance.
 * Used by estimateSingleFare() in fare.service.ts when
 * the booking service needs a single number for METRO mode.
 */
export function cheapestMetroFare(distanceKm: number): number {
    const fares = calculateMetroFare(distanceKm);
    if (fares.length === 0) return 1000; // ₹10 absolute floor
    return Math.min(...fares.map(f => f.totalFare));
}
