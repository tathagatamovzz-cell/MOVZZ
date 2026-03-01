/**
 * Quick email test — run once, then delete.
 * Usage:  npx ts-node test-email.ts
 */

import 'dotenv/config';
import { sendBookingConfirmation, sendBookingCancellation, sendCompensationCredit } from './src/services/email.service';

const TEST_EMAIL = process.env.TEST_EMAIL || 'YOUR_EMAIL_HERE';

async function main() {
    console.log('Sending test emails to:', TEST_EMAIL);
    console.log('RESEND_API_KEY set:', !!process.env.RESEND_API_KEY, '\n');

    console.log('1. Booking confirmation…');
    await sendBookingConfirmation({
        toEmail: TEST_EMAIL,
        userName: 'Tathagata',
        bookingId: 'test-booking-abc123',
        pickup: 'Chennai Central Railway Station',
        dropoff: 'Chennai International Airport',
        providerName: 'Rajan Kumar (TN-01-AB-1234)',
        transportMode: 'CAB',
        fareRupees: 450,
    });

    console.log('2. Booking cancellation…');
    await sendBookingCancellation({
        toEmail: TEST_EMAIL,
        userName: 'Tathagata',
        bookingId: 'test-booking-abc123',
        pickup: 'Chennai Central Railway Station',
        dropoff: 'Chennai International Airport',
    });

    console.log('3. Compensation credit…');
    await sendCompensationCredit({
        toEmail: TEST_EMAIL,
        userName: 'Tathagata',
        bookingId: 'test-booking-abc123',
        amountRupees: 100,
        expiryDays: 30,
    });

    console.log('\nDone! Check your inbox.');
}

main().catch(console.error);
