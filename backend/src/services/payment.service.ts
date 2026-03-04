/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ PAYMENT SERVICE — Razorpay Payment Links
 * ═══════════════════════════════════════════════════════════
 *
 *  Uses Razorpay Payment Links (rzp.io/l/...) instead of the
 *  embedded checkout SDK. The user is redirected to Razorpay's
 *  hosted payment page and returned to the app after paying.
 *
 *  Flow:
 *    1. createPaymentLink()     — creates a Payment Link, returns short_url
 *    2. User redirected to rzp.io link → pays on Razorpay's page
 *    3. Razorpay redirects back to FRONTEND_URL with query params
 *    4. verifyPaymentLink()     — HMAC-SHA256 check, marks booking as paid
 *    5. scheduleProviderPayout() — creates Payout record (T+2 terms)
 *
 *  Callback URL params (GET) from Razorpay:
 *    razorpay_payment_id
 *    razorpay_payment_link_id
 *    razorpay_payment_link_reference_id   (= bookingId we set as reference_id)
 *    razorpay_payment_link_status         (= "paid")
 *    razorpay_signature
 *
 *  Env vars required:
 *    RAZORPAY_KEY_ID       — rzp_test_xxx or rzp_live_xxx
 *    RAZORPAY_KEY_SECRET   — for HMAC verification
 *    FRONTEND_URL          — e.g. http://localhost:5173 (redirect target)
 * ═══════════════════════════════════════════════════════════
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import prisma from '../config/database';

// ─── Razorpay Client (lazy singleton) ───────────────────

let razorpay: Razorpay | null = null;

function getRazorpay(): Razorpay {
    if (!razorpay) {
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keyId || !keySecret) {
            throw new Error(
                '[Payment] RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env'
            );
        }

        razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    }
    return razorpay;
}

// ─── Create Payment Link ─────────────────────────────────

/**
 * createPaymentLink — Creates a Razorpay Payment Link for a booking.
 *
 * Returns a short_url (e.g. https://rzp.io/l/xyz) that the frontend
 * redirects the user to. After payment, Razorpay redirects to FRONTEND_URL
 * with the payment params as query strings.
 *
 * The bookingId is stored as `reference_id` so we can look it up
 * when the user returns (without needing server-side session state).
 */
export async function createPaymentLink(params: {
    bookingId: string;
    amountPaise: number;
    customerPhone?: string;
    pickup: string;
    dropoff: string;
}): Promise<{ shortUrl: string; paymentLinkId: string }> {
    const booking = await prisma.booking.findUnique({ where: { id: params.bookingId } });
    if (!booking) throw new Error('Booking not found');
    if (booking.paidAt) throw new Error('Booking is already paid');

    const rz = getRazorpay();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Razorpay Payment Links API
    const link = await (rz as any).paymentLink.create({
        amount: params.amountPaise,
        currency: 'INR',
        description: `MOVZZ · ${params.pickup} → ${params.dropoff}`,
        reference_id: params.bookingId,        // returned in callback for lookup
        customer: {
            contact: params.customerPhone || '',
        },
        notify: {
            sms: false,     // we handle notifications ourselves
            email: false,
        },
        reminder_enable: false,
        callback_url: frontendUrl,             // Razorpay appends params as query string
        callback_method: 'get',
        notes: {
            bookingId: params.bookingId,
            pickup: params.pickup,
            dropoff: params.dropoff,
        },
    });

    // Store the Payment Link ID (same field as orderId for consistency)
    await prisma.booking.update({
        where: { id: params.bookingId },
        data: { razorpayOrderId: link.id },
    });

    console.log(`[Payment] Payment link created: ${link.short_url} for booking ${params.bookingId}`);

    return { shortUrl: link.short_url, paymentLinkId: link.id };
}

// ─── Verify Payment Link Signature ──────────────────────

/**
 * verifyPaymentLink — Validates Razorpay's payment link callback signature.
 *
 * Razorpay signs with:
 *   HMAC_SHA256(payment_link_id|payment_link_reference_id|payment_link_status|payment_id, KEY_SECRET)
 *
 * On success: marks booking as paid, stores paymentId, sets paidAt.
 */
export async function verifyPaymentLink(params: {
    bookingId: string;
    razorpayPaymentId: string;
    razorpayPaymentLinkId: string;
    razorpayPaymentLinkRefId: string;     // = bookingId we set as reference_id
    razorpayPaymentLinkStatus: string;    // should be "paid"
    razorpaySignature: string;
}): Promise<{ success: true; bookingId: string }> {
    const {
        bookingId,
        razorpayPaymentId,
        razorpayPaymentLinkId,
        razorpayPaymentLinkRefId,
        razorpayPaymentLinkStatus,
        razorpaySignature,
    } = params;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error('[Payment] RAZORPAY_KEY_SECRET not set');

    // Razorpay payment link signature format
    const payload = `${razorpayPaymentLinkId}|${razorpayPaymentLinkRefId}|${razorpayPaymentLinkStatus}|${razorpayPaymentId}`;
    const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(payload)
        .digest('hex');

    if (expectedSignature !== razorpaySignature) {
        console.error(`[Payment] Signature mismatch for booking ${bookingId}`);
        throw new Error('Payment verification failed: invalid signature');
    }

    if (razorpayPaymentLinkStatus !== 'paid') {
        throw new Error(`Payment not completed — status: ${razorpayPaymentLinkStatus}`);
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new Error('Booking not found');

    if (booking.paidAt) {
        // Idempotent — already processed (e.g. double redirect)
        return { success: true, bookingId };
    }

    await prisma.booking.update({
        where: { id: bookingId },
        data: {
            razorpayPaymentId,
            paidAt: new Date(),
        },
    });

    console.log(`[Payment] Payment link verified for booking ${bookingId} — ${razorpayPaymentId}`);

    return { success: true, bookingId };
}

// ─── Schedule Provider Payout (T+2) ─────────────────────

/**
 * scheduleProviderPayout — Creates a PENDING payout record for the provider.
 *
 * T+2 terms: provider receives payment 2 days after ride completes.
 * Commission (10%) is deducted.
 */
export async function scheduleProviderPayout(bookingId: string): Promise<void> {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || !booking.providerId) return;

    const fareActual = booking.fareActual ?? booking.fareEstimate;
    const commissionAmount = Math.round(fareActual * booking.commissionRate);
    const netPayout = fareActual - commissionAmount;

    const paidAt = new Date();
    paidAt.setDate(paidAt.getDate() + 2);

    await prisma.payout.create({
        data: {
            providerId: booking.providerId,
            totalRides: 1,
            totalRevenue: fareActual,
            commissionAmount,
            netPayout,
            status: 'PENDING',
            paidAt,
        },
    });

    console.log(
        `[Payment] Payout scheduled for provider ${booking.providerId}: ` +
        `₹${netPayout / 100} net, due ${paidAt.toDateString()}`
    );
}
