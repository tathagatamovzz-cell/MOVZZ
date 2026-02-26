/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ QUOTES SERVICE — Ride Options & Pricing Engine
 * ═══════════════════════════════════════════════════════════
 *
 *  Generates ride quotes across all transport modes.
 *  Each mode has its own pricing model:
 *
 *  - CAB:   ₹14/km, min ₹80   (Uber, Ola, Rapido)
 *  - BIKE:  ₹6/km,  min ₹25   (Rapido, Uber Moto, Ola Bike)
 *  - AUTO:  ₹9/km,  min ₹30   (Ola Auto, Rapido Auto, Uber Auto)
 *  - METRO: Fixed route-based pricing (no provider scoring)
 *
 *  Task #3: POST /quotes endpoint logic
 *  Task #4: Metro-specific quote logic
 * ═══════════════════════════════════════════════════════════
 */

// ─── Types ──────────────────────────────────────────────

export type TransportMode = 'cab' | 'bike' | 'auto' | 'metro';

export interface RideQuote {
    id: string;
    provider: string;
    type: string;
    transportMode: TransportMode;
    price: number;          // ₹ in rupees
    eta: number;            // minutes
    reliability: number;    // 0-100
    score: number;          // MOVZZ composite score 0-100
    logo: string;
    surge: boolean;
    source: 'simulated' | 'nammayatri';
    tag: QuoteTag | null;   // 'Best Match', 'Cheapest', etc.
    why: string;            // Human-readable scoring rationale
}

export interface MetroQuote {
    id: string;
    provider: string;
    line: string;
    from: string;
    to: string;
    transportMode: 'metro';
    price: number;
    eta: number;           // walk + wait time to board
    duration: number;      // ride duration in minutes
    stations: number;
    reliability: number;
    score: number;
    source: 'metro_schedule';
    tag: QuoteTag | null;
    why: string;
}

// Tag format: string enums matching frontend getToneClass/getTagLabel.
// Frontend expects: 'BEST' | 'CHEAPEST' | 'PREMIUM'
// quotes.controller.ts already uses this format.
export type QuoteTag = 'BEST' | 'CHEAPEST' | 'PREMIUM';

export interface QuotesResult {
    quotes: (RideQuote | MetroQuote)[];
    meta: {
        transportMode: TransportMode;
        distanceKm: number;
        pickupLat: number;
        pickupLng: number;
        dropoffLat: number;
        dropoffLng: number;
        providers: Record<string, boolean>;
        generatedAt: string;
    };
}

// ─── Mode-Specific Fare Configuration ───────────────────

interface FareConfig {
    perKmRate: number;
    baseFare: number;
}

const FARE_CONFIGS: Record<string, FareConfig> = {
    cab: { perKmRate: 14, baseFare: 80 },
    bike: { perKmRate: 6, baseFare: 25 },
    auto: { perKmRate: 9, baseFare: 30 },
};

// ─── Haversine ──────────────────────────────────────────

function haversineDistanceKm(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Provider Quote Templates ───────────────────────────
// Each provider has a price multiplier, base reliability, and ETA range

interface ProviderTemplate {
    provider: string;
    type: string;
    logo: string;
    priceMultiplier: number;
    reliability: number;
    etaMin: number;
    etaMax: number;
    surgeChance: number;   // 0-1 probability
    why: string;           // Template scoring rationale
}

const PROVIDER_TEMPLATES: Record<string, ProviderTemplate[]> = {
    cab: [
        {
            provider: 'Uber', type: 'UberGo', logo: 'uber',
            priceMultiplier: 1.12, reliability: 96, etaMin: 3, etaMax: 8,
            surgeChance: 0.2,
            why: 'Strong 7-day completion trend, low cancel signals, and high nearby driver density.',
        },
        {
            provider: 'Ola', type: 'Ola Mini', logo: 'ola',
            priceMultiplier: 1.0, reliability: 89, etaMin: 4, etaMax: 10,
            surgeChance: 0.05,
            why: 'Balanced cost-to-reliability ratio with consistent pickup performance in this corridor.',
        },
        {
            provider: 'Rapido', type: 'Rapido Cab', logo: 'rapido',
            priceMultiplier: 0.92, reliability: 85, etaMin: 5, etaMax: 12,
            surgeChance: 0.03,
            why: 'Lowest fare in cab segment, moderate cancellation pattern in current pickup zone.',
        },
        {
            provider: 'Uber', type: 'UberXL', logo: 'uber',
            priceMultiplier: 1.70, reliability: 94, etaMin: 5, etaMax: 11,
            surgeChance: 0.3,
            why: 'Premium fleet with high completion certainty and shortest dispatch response.',
        },
        {
            provider: 'Ola', type: 'Ola Prime', logo: 'ola',
            priceMultiplier: 1.55, reliability: 92, etaMin: 4, etaMax: 9,
            surgeChance: 0.08,
            why: 'AC sedan pool with strong peak-hour reliability and GPS coverage.',
        },
    ],
    bike: [
        {
            provider: 'Rapido', type: 'Rapido Bike', logo: 'rapido',
            priceMultiplier: 0.90, reliability: 88, etaMin: 2, etaMax: 6,
            surgeChance: 0.02,
            why: 'Fast lane coverage and stable completion behavior in high-traffic windows.',
        },
        {
            provider: 'Uber', type: 'Uber Moto', logo: 'uber',
            priceMultiplier: 1.05, reliability: 91, etaMin: 3, etaMax: 8,
            surgeChance: 0.05,
            why: 'Priority rider allocation keeps ETA low and failure-recovery rate high.',
        },
        {
            provider: 'Ola', type: 'Ola Bike', logo: 'ola',
            priceMultiplier: 0.85, reliability: 82, etaMin: 4, etaMax: 10,
            surgeChance: 0.02,
            why: 'Most economical option; pickup reliability fluctuates in surge micro-zones.',
        },
    ],
    auto: [
        {
            provider: 'Ola', type: 'Ola Auto', logo: 'ola',
            priceMultiplier: 1.05, reliability: 90, etaMin: 3, etaMax: 8,
            surgeChance: 0.03,
            why: 'Consistent acceptance quality and healthy active supply in pickup radius.',
        },
        {
            provider: 'Rapido', type: 'Rapido Auto', logo: 'rapido',
            priceMultiplier: 0.95, reliability: 87, etaMin: 3, etaMax: 7,
            surgeChance: 0.02,
            why: 'Best price-to-reliability ratio with fast acceptance in current demand band.',
        },
        {
            provider: 'Uber', type: 'Uber Auto', logo: 'uber',
            priceMultiplier: 1.10, reliability: 93, etaMin: 4, etaMax: 9,
            surgeChance: 0.05,
            why: 'Higher completion record and low volatility in nearby auto zones.',
        },
    ],
};

// ─── Metro Route Data (Task #4) ─────────────────────────
// Chennai metro fixed routes — no dynamic provider scoring

interface MetroRoute {
    line: string;
    color: string;
    from: string;
    to: string;
    fromLat: number;
    fromLng: number;
    toLat: number;
    toLng: number;
    stations: number;
    durationMin: number;
    priceRupees: number;
    frequency: number;  // trains per hour
    reliability: number;
}

const CHENNAI_METRO_ROUTES: MetroRoute[] = [
    {
        line: 'Blue Line', color: '#1565C0',
        from: 'Wimco Nagar', to: 'Chennai Airport',
        fromLat: 13.1534, fromLng: 80.3058,
        toLat: 12.9941, toLng: 80.1709,
        stations: 32, durationMin: 55, priceRupees: 60,
        frequency: 6, reliability: 98,
    },
    {
        line: 'Green Line', color: '#2E7D32',
        from: 'Central Metro', to: 'St. Thomas Mount',
        fromLat: 13.0827, fromLng: 80.2707,
        toLat: 13.0082, toLng: 80.2009,
        stations: 17, durationMin: 35, priceRupees: 40,
        frequency: 8, reliability: 97,
    },
    {
        line: 'Blue Line Express', color: '#0D47A1',
        from: 'Wimco Nagar', to: 'Chennai Airport',
        fromLat: 13.1534, fromLng: 80.3058,
        toLat: 12.9941, toLng: 80.1709,
        stations: 12, durationMin: 35, priceRupees: 80,
        frequency: 3, reliability: 99,
    },
    {
        line: 'Green Line', color: '#2E7D32',
        from: 'St. Thomas Mount', to: 'Central Metro',
        fromLat: 13.0082, fromLng: 80.2009,
        toLat: 13.0827, toLng: 80.2707,
        stations: 17, durationMin: 35, priceRupees: 40,
        frequency: 8, reliability: 97,
    },
];

// ─── MOVZZ Scoring Algorithm ────────────────────────────

function calculateMovzzScore(quote: {
    reliability: number;
    price: number;
    eta: number;
    baseScore?: number;
}): number {
    const weights = {
        reliability: 0.35,
        price: 0.25,
        eta: 0.20,
        base: 0.20,
    };

    const reliabilityScore = (quote.reliability / 100) * 100;
    const priceScore = Math.max(0, 100 - (quote.price / 10));
    const etaScore = Math.max(0, 100 - (quote.eta * 5));
    const baseScore = quote.baseScore || 85;

    const composite = Math.round(
        reliabilityScore * weights.reliability +
        priceScore * weights.price +
        etaScore * weights.eta +
        baseScore * weights.base
    );

    return Math.min(99, Math.max(60, composite));
}

// ─── Tag Assignment ─────────────────────────────────────

function assignTags(quotes: (RideQuote | MetroQuote)[]): void {
    if (quotes.length === 0) return;

    let bestTagged = false;
    let cheapestTagged = false;

    const cheapestPrice = Math.min(...quotes.map(q => q.price));

    for (const quote of quotes) {
        if (!bestTagged) {
            quote.tag = 'BEST';
            bestTagged = true;
            continue;
        }

        if (!cheapestTagged && quote.price === cheapestPrice) {
            quote.tag = 'CHEAPEST';
            cheapestTagged = true;
            continue;
        }
    }

    // Tag the most expensive as Premium if not already tagged
    const mostExpensive = [...quotes].sort((a, b) => b.price - a.price)[0];
    if (mostExpensive && !mostExpensive.tag) {
        mostExpensive.tag = 'PREMIUM';
    }
}

// ─── Generate Ride Quotes (CAB / BIKE / AUTO) ───────────

function generateRideQuotes(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
    mode: 'cab' | 'bike' | 'auto',
): RideQuote[] {
    const distKm = haversineDistanceKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
    const fareConfig = FARE_CONFIGS[mode];
    const templates = PROVIDER_TEMPLATES[mode] || [];
    const basePrice = Math.max(fareConfig.baseFare, Math.round(distKm * fareConfig.perKmRate));

    // Add slight randomness for variance between providers
    const distVariance = () => 0.92 + Math.random() * 0.16;

    return templates.map((tmpl, idx) => {
        const price = Math.round(basePrice * tmpl.priceMultiplier * distVariance());
        const eta = Math.round(tmpl.etaMin + Math.random() * (tmpl.etaMax - tmpl.etaMin));
        const surge = Math.random() < tmpl.surgeChance;
        const reliability = tmpl.reliability + Math.round((Math.random() - 0.5) * 4);

        const score = calculateMovzzScore({
            reliability,
            price,
            eta,
            baseScore: tmpl.reliability,
        });

        return {
            id: `quote_${mode}_${tmpl.provider.toLowerCase()}_${idx}_${Date.now()}`,
            provider: tmpl.provider,
            type: tmpl.type,
            transportMode: mode,
            price,
            eta,
            reliability: Math.min(99, Math.max(70, reliability)),
            score,
            logo: tmpl.logo,
            surge,
            source: 'simulated' as const,
            tag: null,
            why: tmpl.why,
        };
    });
}

// ─── Generate Metro Quotes (Task #4) ────────────────────

function generateMetroQuotes(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
): MetroQuote[] {
    // For metro, find which routes are relevant based on proximity
    // to pickup and dropoff stations
    const MAX_STATION_DISTANCE_KM = 5; // Must be within 5km of a metro station

    const results: MetroQuote[] = [];

    for (let idx = 0; idx < CHENNAI_METRO_ROUTES.length; idx++) {
        const route = CHENNAI_METRO_ROUTES[idx];

        const pickupToStation = haversineDistanceKm(
            pickupLat, pickupLng,
            route.fromLat, route.fromLng
        );
        const dropoffToStation = haversineDistanceKm(
            dropoffLat, dropoffLng,
            route.toLat, route.toLng
        );

        // Skip routes where pickup or dropoff is too far from stations
        if (pickupToStation > MAX_STATION_DISTANCE_KM ||
            dropoffToStation > MAX_STATION_DISTANCE_KM) {
            continue;
        }

        // Walk time estimate (5 min/km average)
        const walkTimeMin = Math.round((pickupToStation + dropoffToStation) * 5);
        // Wait time based on frequency
        const avgWaitMin = Math.round(60 / route.frequency / 2);
        const totalEta = walkTimeMin + avgWaitMin;

        const score = calculateMovzzScore({
            reliability: route.reliability,
            price: route.priceRupees,
            eta: totalEta,
            baseScore: route.reliability,
        });

        results.push({
            id: `quote_metro_${route.line.toLowerCase().replace(/\s+/g, '_')}_${idx}_${Date.now()}`,
            provider: 'Chennai Metro',
            line: route.line,
            from: route.from,
            to: route.to,
            transportMode: 'metro',
            price: route.priceRupees,
            eta: totalEta,
            duration: route.durationMin,
            stations: route.stations,
            reliability: route.reliability,
            score,
            source: 'metro_schedule',
            tag: null,
            why: `Fixed rail schedule with ${route.frequency} trains/hr. `
                + `${route.stations} stations, ${route.durationMin} min ride. `
                + `Near-certain arrival window with minimal disruption risk.`,
        });
    }

    return results;
}

// ─── Main: Get Quotes ───────────────────────────────────

export async function getQuotes(params: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    transportMode: TransportMode;
    userPhone?: string;
}): Promise<QuotesResult> {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng, transportMode, userPhone } = params;
    const distanceKm = haversineDistanceKm(pickupLat, pickupLng, dropoffLat, dropoffLng);

    let allQuotes: (RideQuote | MetroQuote)[] = [];
    const providers: Record<string, boolean> = {};

    if (transportMode === 'metro') {
        // ─── Task #4: Metro-specific logic ──────────────
        // No provider scoring — fixed infrastructure routes
        const metroQuotes = generateMetroQuotes(pickupLat, pickupLng, dropoffLat, dropoffLng);
        allQuotes = metroQuotes;
        providers['chennai_metro'] = metroQuotes.length > 0;

        // If no metro routes nearby, return empty with helpful message
        if (metroQuotes.length === 0) {
            // Still return result, frontend will handle empty state
            console.log('ℹ️  No metro routes available near selected locations');
        }
    } else {
        // ─── CAB / BIKE / AUTO quotes ───────────────────

        // 1. Generate simulated provider quotes
        const simulatedQuotes = generateRideQuotes(
            pickupLat, pickupLng, dropoffLat, dropoffLng, transportMode
        );
        allQuotes.push(...simulatedQuotes);
        providers['uber'] = true;
        providers['ola'] = true;
        providers['rapido'] = true;

        // 2. Namma Yatri integration removed
    }

    // ─── Sort by MOVZZ score (descending) ───────────────
    allQuotes.sort((a, b) => b.score - a.score);

    // ─── Assign tags (Best Match, Cheapest, etc.) ───────
    assignTags(allQuotes);

    return {
        quotes: allQuotes,
        meta: {
            transportMode,
            distanceKm: Math.round(distanceKm * 10) / 10,
            pickupLat,
            pickupLng,
            dropoffLat,
            dropoffLng,
            providers,
            generatedAt: new Date().toISOString(),
        },
    };
}
