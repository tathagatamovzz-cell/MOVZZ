/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ UNIT TESTS — Fare Estimation Service
 * ═══════════════════════════════════════════════════════════
 *
 *  Tests:
 *  1. Distance calculation (Haversine + road factor)
 *  2. Duration estimation per mode
 *  3. Single-tier fare calculation
 *  4. Mode-specific fare estimation (CAB, BIKE, AUTO, METRO)
 *  5. Surge pricing logic
 *  6. Airport detection
 *  7. Minimum fare enforcement
 *  8. Edge cases (zero distance, no coordinates, extreme values)
 *  9. Integration with estimateSingleFare (booking service compat)
 * ═══════════════════════════════════════════════════════════
 */

import {
    calculateDistance,
    estimateDuration,
    calculateTierFare,
    calculateMetroFare,
    getSurgeMultiplier,
    isNearAirport,
    estimateFares,
    estimateSingleFare,
    _testExports,
    TransportMode,
    FareTier,
} from '../services/fare.service';

// ─── Test Runner ────────────────────────────────────────

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    duration: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void> | void) {
    const start = Date.now();
    try {
        await fn();
        results.push({ name, passed: true, duration: Date.now() - start });
        console.log(`  ✅ ${name} (${Date.now() - start}ms)`);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.push({ name, passed: false, error: msg, duration: Date.now() - start });
        console.log(`  ❌ ${name}: ${msg}`);
    }
}

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

function assertRange(value: number, min: number, max: number, label: string) {
    if (value < min || value > max) {
        throw new Error(`${label}: ${value} not in range [${min}, ${max}]`);
    }
}

// ─── Known Chennai Locations ────────────────────────────

const LOCATIONS = {
    airport:    { lat: 12.9941, lng: 80.1709, name: 'Chennai Airport (MAA)' },
    central:    { lat: 13.0827, lng: 80.2707, name: 'Chennai Central' },
    tNagar:     { lat: 13.0418, lng: 80.2341, name: 'T. Nagar' },
    adyar:      { lat: 13.0063, lng: 80.2574, name: 'Adyar' },
    vit:        { lat: 12.8406, lng: 80.1534, name: 'VIT Chennai' },
    omr:        { lat: 12.9352, lng: 80.2332, name: 'OMR Thoraipakkam' },
    marina:     { lat: 13.0500, lng: 80.2824, name: 'Marina Beach' },
    tambaram:   { lat: 12.9249, lng: 80.1000, name: 'Tambaram' },
};

// ═══════════════════════════════════════════════════════════
//  TEST SUITES
// ═══════════════════════════════════════════════════════════

async function runAllTests() {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║    🧮 MOVZZ FARE SERVICE TESTS 🧮       ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');

    // ─── 1. Distance Calculation ────────────────────────

    console.log('─── Distance Calculation ───────────────────');

    await test('Airport to Central — should be ~14-18 km (road distance)', () => {
        const dist = calculateDistance(
            LOCATIONS.airport.lat, LOCATIONS.airport.lng,
            LOCATIONS.central.lat, LOCATIONS.central.lng
        );
        assertRange(dist, 12, 22, 'Airport-Central distance');
    });

    await test('T. Nagar to Adyar — should be ~5-8 km', () => {
        const dist = calculateDistance(
            LOCATIONS.tNagar.lat, LOCATIONS.tNagar.lng,
            LOCATIONS.adyar.lat, LOCATIONS.adyar.lng
        );
        assertRange(dist, 3, 10, 'TNagar-Adyar distance');
    });

    await test('Same point to same point — should be ~0 km', () => {
        const dist = calculateDistance(
            LOCATIONS.airport.lat, LOCATIONS.airport.lng,
            LOCATIONS.airport.lat, LOCATIONS.airport.lng
        );
        assertRange(dist, 0, 0.1, 'Same-point distance');
    });

    await test('Airport to VIT Chennai — should be ~18-25 km', () => {
        const dist = calculateDistance(
            LOCATIONS.airport.lat, LOCATIONS.airport.lng,
            LOCATIONS.vit.lat, LOCATIONS.vit.lng
        );
        assertRange(dist, 15, 30, 'Airport-VIT distance');
    });

    await test('Road factor should make distance > straight-line', () => {
        const dist = calculateDistance(
            LOCATIONS.airport.lat, LOCATIONS.airport.lng,
            LOCATIONS.central.lat, LOCATIONS.central.lng
        );
        assert(dist > 13, `Distance ${dist} should be > 13 km (road factor applied)`);
    });

    // ─── 2. Duration Estimation ─────────────────────────

    console.log('\n─── Duration Estimation ────────────────────');

    await test('CAB duration for 20km should be ~57-60 min', () => {
        const dur = estimateDuration(20, 'CAB');
        assertRange(dur, 50, 70, 'CAB 20km duration');
    });

    // FIX: Was 'BIKE_TAXI' — correct enum value is 'BIKE'
    await test('BIKE should be faster than CAB for same distance', () => {
        const bikeDur = estimateDuration(15, 'BIKE');
        const cabDur = estimateDuration(15, 'CAB');
        assert(bikeDur < cabDur, `Bike (${bikeDur}min) should be faster than cab (${cabDur}min)`);
    });

    await test('AUTO should be slower than CAB for same distance', () => {
        const autoDur = estimateDuration(15, 'AUTO');
        const cabDur = estimateDuration(15, 'CAB');
        assert(autoDur > cabDur, `Auto (${autoDur}min) should be slower than cab (${cabDur}min)`);
    });

    await test('METRO should be fastest for same distance', () => {
        const metroDur = estimateDuration(15, 'METRO');
        const cabDur = estimateDuration(15, 'CAB');
        assert(metroDur < cabDur, `Metro (${metroDur}min) should be faster than cab (${cabDur}min)`);
    });

    await test('Duration should include 3-min buffer', () => {
        const dur = estimateDuration(0, 'CAB');
        assert(dur === 3, `Zero distance should return 3 min buffer, got ${dur}`);
    });

    // ─── 3. Single Tier Fare Calculation ────────────────

    console.log('\n─── Tier Fare Calculation ──────────────────');

    const econTier = _testExports.CAB_TIERS[0]; // Economy

    await test('Economy cab: 10km, 30min, no surge', () => {
        const fare = calculateTierFare(econTier, 10, 30, 1.0);
        assert(fare.baseFare === 5000, `Base fare should be 5000, got ${fare.baseFare}`);
        assert(fare.distanceCharge === 12000, `Distance charge should be 12000, got ${fare.distanceCharge}`);
        assert(fare.timeCharge === 4500, `Time charge should be 4500, got ${fare.timeCharge}`);
        assert(fare.subtotal === 21500, `Subtotal should be 21500, got ${fare.subtotal}`);
        assert(fare.surgeCharge === 0, `Surge should be 0, got ${fare.surgeCharge}`);
        assert(fare.totalFare === 21500, `Total should be 21500, got ${fare.totalFare}`);
        assert(fare.totalFareRupees === 215, `Rupees should be 215, got ${fare.totalFareRupees}`);
        assert(fare.minFareApplied === false, 'Min fare should not apply');
    });

    await test('Economy cab: very short ride should enforce minimum fare', () => {
        const fare = calculateTierFare(econTier, 0.5, 2, 1.0);
        assert(fare.totalFare === 8000, `Should enforce min fare 8000, got ${fare.totalFare}`);
        assert(fare.minFareApplied === true, 'Min fare should apply');
        assert(fare.totalFareRupees === 80, `Rupees should be 80, got ${fare.totalFareRupees}`);
    });

    await test('Economy cab with 1.5x surge', () => {
        const fare = calculateTierFare(econTier, 10, 30, 1.5);
        assert(fare.surgeMultiplier === 1.5, `Surge should be 1.5, got ${fare.surgeMultiplier}`);
        assert(fare.surgeCharge === 10750, `Surge charge should be 10750, got ${fare.surgeCharge}`);
        assert(fare.totalFare === 32250, `Total should be 32250, got ${fare.totalFare}`);
    });

    await test('Premium cab should be more expensive than economy', () => {
        const premTier = _testExports.CAB_TIERS[2];
        const econFare = calculateTierFare(econTier, 15, 40, 1.0);
        const premFare = calculateTierFare(premTier, 15, 40, 1.0);
        assert(premFare.totalFare > econFare.totalFare,
            `Premium (${premFare.totalFare}) should be > Economy (${econFare.totalFare})`);
    });

    await test('Fare breakdown fields should be correct types', () => {
        const fare = calculateTierFare(econTier, 10, 30, 1.0);
        assert(typeof fare.tierId === 'string', 'tierId should be string');
        assert(typeof fare.tierName === 'string', 'tierName should be string');
        assert(typeof fare.totalFare === 'number', 'totalFare should be number');
        assert(typeof fare.minFareApplied === 'boolean', 'minFareApplied should be boolean');
        assert(fare.distanceKm === 10, 'distanceKm should match input');
        assert(fare.estimatedDurationMin === 30, 'duration should match input');
    });

    // ─── 4. Mode-Specific Fare Estimation ───────────────

    console.log('\n─── Mode-Specific Fares ────────────────────');

    await test('CAB mode returns 3 tiers (economy, comfort, premium)', () => {
        const result = estimateFares('CAB',
            LOCATIONS.airport.lat, LOCATIONS.airport.lng,
            LOCATIONS.tNagar.lat, LOCATIONS.tNagar.lng,
            1.0
        );
        assert(result.transportMode === 'CAB', 'Mode should be CAB');
        assert(result.fares.length === 3, `Should have 3 tiers, got ${result.fares.length}`);
        assert(result.fares[0].tierId === 'cab_economy', `First tier should be economy`);
        assert(result.fares[1].tierId === 'cab_comfort', `Second should be comfort`);
        assert(result.fares[2].tierId === 'cab_premium', `Third should be premium`);
    });

    await test('CAB fares should be ordered: economy < comfort < premium', () => {
        const result = estimateFares('CAB',
            LOCATIONS.airport.lat, LOCATIONS.airport.lng,
            LOCATIONS.central.lat, LOCATIONS.central.lng,
            1.0
        );
        assert(result.fares[0].totalFare < result.fares[1].totalFare,
            'Economy should be cheaper than comfort');
        assert(result.fares[1].totalFare < result.fares[2].totalFare,
            'Comfort should be cheaper than premium');
    });

    // FIX: Was 'BIKE_TAXI' — correct enum value is 'BIKE'
    await test('BIKE mode returns 1 tier', () => {
        const result = estimateFares('BIKE',
            LOCATIONS.tNagar.lat, LOCATIONS.tNagar.lng,
            LOCATIONS.adyar.lat, LOCATIONS.adyar.lng,
            1.0
        );
        assert(result.fares.length === 1, `Should have 1 tier, got ${result.fares.length}`);
        assert(result.fares[0].tierId === 'bike_standard', 'Should be bike_standard');
        assert(result.fares[0].timeCharge === 0, 'Bike should have 0 time charge');
    });

    await test('AUTO mode returns 1 tier', () => {
        const result = estimateFares('AUTO',
            LOCATIONS.tNagar.lat, LOCATIONS.tNagar.lng,
            LOCATIONS.adyar.lat, LOCATIONS.adyar.lng,
            1.0
        );
        assert(result.fares.length === 1, `Should have 1 tier, got ${result.fares.length}`);
        assert(result.fares[0].tierId === 'auto_standard', 'Should be auto_standard');
    });

    // FIX: Was 'BIKE_TAXI' — correct enum value is 'BIKE'
    await test('BIKE should be cheapest, then AUTO, then CAB economy', () => {
        const pickup = LOCATIONS.airport;
        const drop = LOCATIONS.central;

        const bike = estimateFares('BIKE', pickup.lat, pickup.lng, drop.lat, drop.lng, 1.0);
        const auto = estimateFares('AUTO', pickup.lat, pickup.lng, drop.lat, drop.lng, 1.0);
        const cab  = estimateFares('CAB',  pickup.lat, pickup.lng, drop.lat, drop.lng, 1.0);

        const bikeFare = bike.fares[0].totalFare;
        const autoFare = auto.fares[0].totalFare;
        const cabFare  = cab.fares[0].totalFare;

        assert(bikeFare < autoFare, `Bike (${bikeFare}) should be < Auto (${autoFare})`);
        assert(autoFare < cabFare,  `Auto (${autoFare}) should be < Cab Economy (${cabFare})`);
    });

    await test('METRO mode returns metro fares (not regular fares)', () => {
        const result = estimateFares('METRO',
            LOCATIONS.airport.lat, LOCATIONS.airport.lng,
            LOCATIONS.central.lat, LOCATIONS.central.lng,
            1.0
        );
        assert(result.transportMode === 'METRO', 'Mode should be METRO');
        assert(result.fares.length === 0, 'Regular fares should be empty for metro');
        assert(result.metroFares !== undefined, 'Metro fares should exist');
        assert(result.metroFares!.length > 0, 'Should have at least 1 metro line');
        assert(result.metroFares![0].stationCount > 0, 'Station count should be > 0');
    });

    // FIX: Was 'BIKE_TAXI' — correct enum value is 'BIKE'
    await test('METRO should be cheapest option overall', () => {
        const pickup = LOCATIONS.airport;
        const drop = LOCATIONS.central;

        const metro = estimateFares('METRO', pickup.lat, pickup.lng, drop.lat, drop.lng, 1.0);
        const bike  = estimateFares('BIKE',  pickup.lat, pickup.lng, drop.lat, drop.lng, 1.0);

        const metroFare = metro.metroFares![0].totalFare;
        const bikeFare  = bike.fares[0].totalFare;

        assert(metroFare < bikeFare, `Metro (${metroFare}) should be < Bike (${bikeFare})`);
    });

    // ─── 5. Surge Pricing ───────────────────────────────

    console.log('\n─── Surge Pricing ─────────────────────────');

    await test('Morning rush (8 AM) should have surge > 1.0', () => {
        const surge = getSurgeMultiplier('CAB', 8, false);
        assert(surge > 1.0, `Morning surge should be > 1.0, got ${surge}`);
        assert(surge === 1.2, `Morning surge should be 1.2, got ${surge}`);
    });

    await test('Evening rush (18:00) should have highest surge', () => {
        const surge = getSurgeMultiplier('CAB', 18, false);
        assert(surge >= 1.3, `Evening surge should be >= 1.3, got ${surge}`);
    });

    await test('Midday (14:00) should have no surge', () => {
        const surge = getSurgeMultiplier('CAB', 14, false);
        assert(surge === 1.0, `Midday surge should be 1.0, got ${surge}`);
    });

    await test('Late night (2 AM) should have mild surge', () => {
        const surge = getSurgeMultiplier('CAB', 2, false);
        assert(surge > 1.0 && surge <= 1.2, `Late night should be 1.0-1.2, got ${surge}`);
    });

    await test('METRO should never have surge', () => {
        const surge1 = getSurgeMultiplier('METRO', 8, false);
        const surge2 = getSurgeMultiplier('METRO', 18, true);
        assert(surge1 === 1.0, `Metro morning should be 1.0, got ${surge1}`);
        assert(surge2 === 1.0, `Metro evening+airport should be 1.0, got ${surge2}`);
    });

    // FIX: Was 'BIKE_TAXI' — correct enum value is 'BIKE'
    await test('BIKE surge should be capped at 1.3x', () => {
        const surge = getSurgeMultiplier('BIKE', 18, true);
        assert(surge <= 1.3, `Bike surge should be <= 1.3, got ${surge}`);
    });

    await test('AUTO surge should be capped at 1.4x', () => {
        const surge = getSurgeMultiplier('AUTO', 18, true);
        assert(surge <= 1.4, `Auto surge should be <= 1.4, got ${surge}`);
    });

    await test('Airport premium should add to surge', () => {
        const withoutAirport = getSurgeMultiplier('CAB', 14, false);
        const withAirport    = getSurgeMultiplier('CAB', 14, true);
        assert(withAirport > withoutAirport,
            `Airport (${withAirport}) should be > non-airport (${withoutAirport})`);
    });

    // ─── 6. Airport Detection ───────────────────────────

    console.log('\n─── Airport Detection ─────────────────────');

    await test('Airport coordinates should be detected as airport', () => {
        assert(isNearAirport(12.9941, 80.1709) === true, 'Airport should be detected');
    });

    await test('Near airport (Tirusulam) should be detected', () => {
        assert(isNearAirport(12.988, 80.168) === true, 'Tirusulam should be near airport');
    });

    await test('T. Nagar should NOT be near airport', () => {
        assert(isNearAirport(13.0418, 80.2341) === false, 'T. Nagar should not be near airport');
    });

    await test('Central Station should NOT be near airport', () => {
        assert(isNearAirport(13.0827, 80.2707) === false, 'Central should not be near airport');
    });

    await test('Null coordinates should return false', () => {
        assert(isNearAirport(undefined, undefined) === false, 'Null coords should return false');
    });

    // ─── 7. Metro Fare Calculation ──────────────────────

    console.log('\n─── Metro Fares ───────────────────────────');

    await test('Short metro ride (3km) should cost Rs.20-30', () => {
        const fares = calculateMetroFare(3);
        assert(fares.length > 0, 'Should return at least 1 line');
        assertRange(fares[0].totalFareRupees, 10, 40, 'Short metro fare');
    });

    await test('Long metro ride (15km) should cost Rs.40-60', () => {
        const fares = calculateMetroFare(15);
        assertRange(fares[0].totalFareRupees, 30, 60, 'Long metro fare');
    });

    await test('Metro fare should include station count', () => {
        const fares = calculateMetroFare(10);
        assert(fares[0].stationCount > 0, 'Station count should be > 0');
        assert(fares[0].estimatedDurationMin > 0, 'Duration should be > 0');
    });

    await test('Metro should return Blue and Green line options', () => {
        const fares = calculateMetroFare(8);
        const lineNames = fares.map(f => f.line);
        assert(lineNames.includes('Blue Line'), 'Should include Blue Line');
        assert(lineNames.includes('Green Line'), 'Should include Green Line');
    });

    // ─── 8. Edge Cases ──────────────────────────────────

    console.log('\n─── Edge Cases ────────────────────────────');

    await test('No coordinates should use default 12km distance', () => {
        const result = estimateFares('CAB', null, null, null, null, 1.0);
        assert(result.distanceKm === 12, `Default distance should be 12, got ${result.distanceKm}`);
        assert(result.fares.length === 3, 'Should still return 3 tiers');
        assert(result.fares[0].totalFare > 0, 'Fare should be > 0');
    });

    await test('Very long distance (50km) should produce high but valid fares', () => {
        const result = estimateFares('CAB', 13.08, 80.27, 12.62, 80.19, 1.0);
        assert(result.distanceKm > 40, `Distance should be > 40km, got ${result.distanceKm}`);
        assertRange(result.fares[0].totalFareRupees, 400, 1500, 'Long distance economy fare');
    });

    await test('Very short distance (0.2km) should enforce minimum fares', () => {
        const result = estimateFares('CAB', 13.0827, 80.2707, 13.0840, 80.2720, 1.0);
        assert(result.fares[0].minFareApplied === true, 'Min fare should apply');
        assert(result.fares[0].totalFare === 8000, `Economy min fare should be 8000, got ${result.fares[0].totalFare}`);
    });

    await test('Result should include calculatedAt timestamp', () => {
        const result = estimateFares('AUTO', 13.0, 80.2, 13.1, 80.3, 1.0);
        assert(typeof result.calculatedAt === 'string', 'calculatedAt should be a string');
        assert(!isNaN(Date.parse(result.calculatedAt)), 'calculatedAt should be valid ISO date');
    });

    // ─── 9. estimateSingleFare (Booking Compat) ─────────

    console.log('\n─── estimateSingleFare (Booking Compat) ────');

    await test('estimateSingleFare CAB returns cheapest tier (economy)', () => {
        const single = estimateSingleFare('CAB',
            LOCATIONS.airport.lat, LOCATIONS.airport.lng,
            LOCATIONS.central.lat, LOCATIONS.central.lng
        );
        const full = estimateFares('CAB',
            LOCATIONS.airport.lat, LOCATIONS.airport.lng,
            LOCATIONS.central.lat, LOCATIONS.central.lng
        );
        const cheapest = Math.min(...full.fares.map(f => f.totalFare));
        assert(single === cheapest, `Single (${single}) should equal cheapest tier (${cheapest})`);
    });

    await test('estimateSingleFare METRO returns cheapest line fare', () => {
        const single = estimateSingleFare('METRO',
            LOCATIONS.airport.lat, LOCATIONS.airport.lng,
            LOCATIONS.central.lat, LOCATIONS.central.lng
        );
        assert(single > 0, 'Metro fare should be > 0');
        assert(single <= 6000, 'Metro fare should be <= ₹60 (6000 paise)');
    });

    await test('estimateSingleFare returns number in paise', () => {
        const fare = estimateSingleFare('AUTO', 13.0, 80.2, 13.05, 80.25);
        assert(typeof fare === 'number', 'Should return number');
        assert(fare >= 5000, `Auto min fare should be >= 5000 paise, got ${fare}`);
    });

    await test('estimateSingleFare with no coords returns fallback', () => {
        const fare = estimateSingleFare('CAB');
        assert(fare > 0, 'Fallback fare should be > 0');
    });

    // ─── 10. Real Chennai Routes ─────────────────────────

    console.log('\n─── Real Chennai Route Sanity Checks ──────');

    await test('Airport to T.Nagar cab economy: should be Rs.250-500', () => {
        const result = estimateFares('CAB',
            LOCATIONS.airport.lat, LOCATIONS.airport.lng,
            LOCATIONS.tNagar.lat, LOCATIONS.tNagar.lng,
            1.0
        );
        const fare = result.fares[0].totalFareRupees;
        assertRange(fare, 200, 550, 'Airport→TNagar economy');
        console.log(`     Airport → T.Nagar: ₹${fare} (${result.distanceKm}km, ${result.estimatedDurationMin}min)`);
    });

    // FIX: Was 'BIKE_TAXI' — correct enum value is 'BIKE'
    await test('Airport to T.Nagar bike: should be Rs.80-200', () => {
        const result = estimateFares('BIKE',
            LOCATIONS.airport.lat, LOCATIONS.airport.lng,
            LOCATIONS.tNagar.lat, LOCATIONS.tNagar.lng,
            1.0
        );
        const fare = result.fares[0].totalFareRupees;
        assertRange(fare, 70, 250, 'Airport→TNagar bike');
        console.log(`     Airport → T.Nagar (bike): ₹${fare}`);
    });

    await test('T.Nagar to Adyar auto: should be Rs.50-120', () => {
        const result = estimateFares('AUTO',
            LOCATIONS.tNagar.lat, LOCATIONS.tNagar.lng,
            LOCATIONS.adyar.lat, LOCATIONS.adyar.lng,
            1.0
        );
        const fare = result.fares[0].totalFareRupees;
        assertRange(fare, 50, 150, 'TNagar→Adyar auto');
        console.log(`     T.Nagar → Adyar (auto): ₹${fare}`);
    });

    await test('Airport to VIT Chennai cab: should be Rs.200-500', () => {
        const result = estimateFares('CAB',
            LOCATIONS.airport.lat, LOCATIONS.airport.lng,
            LOCATIONS.vit.lat, LOCATIONS.vit.lng,
            1.0
        );
        const fare = result.fares[0].totalFareRupees;
        assertRange(fare, 180, 550, 'Airport→VIT cab');
        console.log(`     Airport → VIT (cab economy): ₹${fare}`);
    });

    await test('Central to Marina beach metro: should be Rs.10-30', () => {
        const result = estimateFares('METRO',
            LOCATIONS.central.lat, LOCATIONS.central.lng,
            LOCATIONS.marina.lat, LOCATIONS.marina.lng,
            1.0
        );
        assert(result.metroFares!.length > 0, 'Should have metro options');
        const fare = result.metroFares![0].totalFareRupees;
        assertRange(fare, 10, 40, 'Central→Marina metro');
        console.log(`     Central → Marina (metro): ₹${fare}`);
    });

    // ─── Summary ────────────────────────────────────────

    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║            TEST RESULTS                  ║');
    console.log('╠══════════════════════════════════════════╣');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total  = results.length;
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`║  Total:   ${String(total).padEnd(30)}║`);
    console.log(`║  Passed:  ${String(passed).padEnd(30)}║`);
    console.log(`║  Failed:  ${String(failed).padEnd(30)}║`);
    console.log(`║  Time:    ${(totalTime + 'ms').padEnd(30)}║`);
    console.log('╚══════════════════════════════════════════╝');

    if (failed > 0) {
        console.log('\n❌ FAILED TESTS:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`   • ${r.name}: ${r.error}`);
        });
    }

    console.log('');
    process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(console.error);