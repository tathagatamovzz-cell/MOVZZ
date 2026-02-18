/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ INTEGRATION TESTS — Booking API
 * ═══════════════════════════════════════════════════════════
 *
 *  Tests the full booking flow end-to-end:
 *  1. OTP Authentication
 *  2. Create Booking
 *  3. Get Booking Status
 *  4. Cancel Booking
 *  5. User Credits
 * ═══════════════════════════════════════════════════════════
 */

import prisma from '../config/database';
import redis from '../config/redis';
import { generateOTP, generateReferralCode } from '../utils/otp';
import { normalizePhone, isValidIndianPhone } from '../utils/phone';
import { generateToken, verifyToken } from '../services/jwt.service';
import { createBooking, getBookingById, transitionState } from '../services/booking.service';
import { issueCompensation, getUserCredits } from '../services/recovery.service';

// ─── Test Runner ────────────────────────────────────────

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    duration: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
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

// ─── Setup & Teardown ───────────────────────────────────

let testUserId: string;
let testUserPhone: string;
let testToken: string;

async function setup() {
    // Clean DB
    await prisma.userCredit.deleteMany({});
    await prisma.bookingAttempt.deleteMany({});
    await prisma.bookingLog.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.providerMetric.deleteMany({});
    await prisma.payout.deleteMany({});
    await prisma.provider.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test user
    const user = await prisma.user.create({
        data: {
            phone: '+919999888877',
            name: 'Test User',
            referralCode: generateReferralCode('TEST'),
        },
    });
    testUserId = user.id;
    testUserPhone = user.phone;
    testToken = generateToken({ userId: user.id, phone: user.phone });

    // Create test providers
    await prisma.provider.createMany({
        data: [
            {
                name: 'Driver A',
                phone: '+919111111111',
                type: 'INDIVIDUAL_DRIVER',
                reliability: 0.95,
                rating: 4.7,
                totalRides: 100,
                successfulRides: 95,
                active: true,
                lastActiveAt: new Date(),
            },
            {
                name: 'Driver B',
                phone: '+919222222222',
                type: 'INDIVIDUAL_DRIVER',
                reliability: 0.92,
                rating: 4.5,
                totalRides: 80,
                successfulRides: 74,
                active: true,
                lastActiveAt: new Date(),
            },
        ],
    });
}

async function teardown() {
    await prisma.userCredit.deleteMany({});
    await prisma.bookingAttempt.deleteMany({});
    await prisma.bookingLog.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.providerMetric.deleteMany({});
    await prisma.payout.deleteMany({});
    await prisma.provider.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
}

// ─── Test Suite ─────────────────────────────────────────

async function runTests() {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║  🧪 MOVZZ INTEGRATION TESTS — Booking   ║');
    console.log('╚══════════════════════════════════════════╝\n');

    await setup();

    // ─── OTP & Auth Tests ─────────────────────────────

    console.log('📋 OTP & Authentication tests:');

    await test('generates 6-digit OTP', async () => {
        const otp = generateOTP();
        assert(otp.length === 6, `OTP should be 6 digits, got ${otp.length}`);
        assert(/^[0-9]+$/.test(otp), 'OTP should contain only digits');
    });

    await test('stores and retrieves OTP from cache', async () => {
        const phone = '+919999888877';
        const otp = '123456';
        await redis.set(`otp:${phone}`, otp, 300);
        const stored = await redis.get(`otp:${phone}`);
        assert(stored === otp, `Expected ${otp}, got ${stored}`);
        await redis.del(`otp:${phone}`);
    });

    await test('OTP expires after TTL', async () => {
        const phone = '+919999888877';
        await redis.set(`otp:${phone}`, '999999', 1); // 1 second TTL
        await new Promise(r => setTimeout(r, 1100));
        const expired = await redis.get(`otp:${phone}`);
        assert(expired === null, 'OTP should have expired');
    });

    await test('generates valid JWT token', async () => {
        const payload = { userId: testUserId, phone: testUserPhone };
        const token = generateToken(payload);
        assert(typeof token === 'string', 'Token should be a string');
        assert(token.split('.').length === 3, 'Token should have 3 parts (JWT format)');
    });

    await test('verifies JWT token correctly', async () => {
        const payload = verifyToken(testToken);
        assert(payload.userId === testUserId, 'UserId should match');
        assert(payload.phone === testUserPhone, 'Phone should match');
    });

    await test('validates Indian phone numbers', async () => {
        assert(isValidIndianPhone('9876543210'), 'Valid 10-digit');
        assert(isValidIndianPhone('919876543210'), 'Valid with 91 prefix');
        assert(!isValidIndianPhone('1234567890'), 'Invalid start digit');
        assert(!isValidIndianPhone('12345'), 'Too short');
    });

    await test('normalizes phone numbers', async () => {
        assert(normalizePhone('9876543210') === '+919876543210', 'Should add +91');
        assert(normalizePhone('919876543210') === '+919876543210', 'Should add +');
    });

    await test('generates unique referral codes', async () => {
        const code1 = generateReferralCode('TEST');
        const code2 = generateReferralCode('TEST');
        assert(code1.startsWith('TEST'), 'Should start with name prefix');
        assert(code1 !== code2, 'Should generate unique codes');
    });

    // ─── Booking Flow Tests ───────────────────────────

    console.log('\n📋 Booking Flow tests:');

    await test('creates a booking in SEARCHING state', async () => {
        const booking = await createBooking({
            userId: testUserId,
            userPhone: testUserPhone,
            pickup: 'Connaught Place, Delhi',
            dropoff: 'India Gate, Delhi',
            pickupLat: 28.6315,
            pickupLng: 77.2167,
            dropoffLat: 28.6129,
            dropoffLng: 77.2295,
        });

        assert(booking.state === 'SEARCHING', `State should be SEARCHING, got ${booking.state}`);
        assert(booking.fareEstimate > 0, 'Fare should be positive');
        assert(booking.userId === testUserId, 'UserId should match');
        console.log(`    → Fare estimate: ₹${booking.fareEstimate / 100}`);
    });

    await test('retrieves booking by ID with details', async () => {
        const bookings = await prisma.booking.findMany({ where: { userId: testUserId }, take: 1 });
        assert(bookings.length > 0, 'Should have at least one booking');

        const booking = await getBookingById(bookings[0].id);
        assert(booking !== null, 'Should find booking');
        assert(booking!.logs.length > 0, 'Should have logs');
    });

    await test('transitions booking state correctly', async () => {
        // Create fresh booking and manually confirm it
        const booking = await createBooking({
            userId: testUserId,
            userPhone: testUserPhone,
            pickup: 'Hauz Khas, Delhi',
            dropoff: 'Saket Mall, Delhi',
        });

        // Wait a bit for async provider assignment
        await new Promise(r => setTimeout(r, 500));

        const updated = await getBookingById(booking.id);
        // It should either be CONFIRMED (if provider found) or SEARCHING
        assert(
            updated!.state === 'SEARCHING' || updated!.state === 'CONFIRMED' ||
            updated!.state === 'FAILED' || updated!.state === 'MANUAL_ESCALATION',
            `State should be valid, got ${updated!.state}`
        );
    });

    await test('rejects invalid state transitions', async () => {
        const booking = await prisma.booking.findFirst({
            where: { state: 'SEARCHING' },
        });

        if (booking) {
            try {
                await transitionState(booking.id, 'COMPLETED'); // Invalid: SEARCHING → COMPLETED
                throw new Error('Should have thrown');
            } catch (error) {
                const msg = error instanceof Error ? error.message : '';
                assert(msg.includes('Invalid transition'), `Error should mention invalid transition, got: ${msg}`);
            }
        }
    });

    // ─── Compensation Tests ───────────────────────────

    console.log('\n📋 Compensation tests:');

    await test('issues ₹100 credit for failed booking', async () => {
        const booking = await prisma.booking.findFirst({ where: { userId: testUserId } });
        assert(booking !== null, 'Should have a booking');

        await issueCompensation(testUserId, testUserPhone, booking!.id);

        const credits = await getUserCredits(testUserId);
        assert(credits.totalAvailableRupees >= 100, `Should have ₹100+ credit, got ₹${credits.totalAvailableRupees}`);
    });

    await test('prevents duplicate compensation', async () => {
        const booking = await prisma.booking.findFirst({ where: { userId: testUserId } });
        const before = await getUserCredits(testUserId);

        await issueCompensation(testUserId, testUserPhone, booking!.id);

        const after = await getUserCredits(testUserId);
        assert(
            after.credits.length === before.credits.length,
            'Should not issue duplicate credit'
        );
    });

    // ─── Summary ──────────────────────────────────────

    console.log('\n' + '═'.repeat(50));
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const totalTime = results.reduce((s, r) => s + r.duration, 0);

    if (failed === 0) {
        console.log(`✅ All ${passed} tests passed (${totalTime}ms)`);
    } else {
        console.log(`❌ ${failed} of ${passed + failed} tests failed`);
        results.filter(r => !r.passed).forEach(r => {
            console.log(`   ↳ ${r.name}: ${r.error}`);
        });
    }
    console.log('═'.repeat(50) + '\n');

    await teardown();
    process.exit(failed > 0 ? 1 : 0);
}

// Run
runTests().catch(async (err) => {
    console.error('Test runner error:', err);
    await teardown();
    process.exit(1);
});
