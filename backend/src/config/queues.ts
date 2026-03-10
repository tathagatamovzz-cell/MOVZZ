/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ BULLMQ QUEUE SINGLETONS
 * ═══════════════════════════════════════════════════════════
 *  Three queues, all backed by the same Redis instance that
 *  ioredis uses. Workers are registered in index.ts.
 *
 *  Queues:
 *   booking-timeout      — auto-cancel bookings stuck in SEARCHING
 *   recovery-retry       — async provider retry with delay
 *   sms-dispatch         — retryable SMS/OTP delivery
 *   nightly-aggregation  — CRON: aggregate provider metrics at midnight
 *   ml-data-collection   — collect training data after booking outcome
 * ═══════════════════════════════════════════════════════════
 */

import { Queue } from 'bullmq';

// Parse REDIS_URL to get host/port for BullMQ connection config.
// BullMQ needs { host, port } — not a URL string or an ioredis instance.
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const parsed = new URL(redisUrl);

export const connection = {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port) || 6379,
};

// ─── Booking Timeout Queue ───────────────────────────────
// Jobs are added with a 5-minute delay immediately after booking
// creation. If the booking is still in SEARCHING when the job fires,
// it is auto-transitioned to FAILED and compensation is issued.
export const bookingTimeoutQueue = new Queue('booking-timeout', {
    connection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 100, // keep last 100 failed jobs for inspection
    },
});

// ─── Recovery Retry Queue ────────────────────────────────
// Jobs are added when no provider is found during initial assignment.
// A 2-second delay gives time for any in-flight provider response
// before the recovery logic runs.
export const recoveryQueue = new Queue('recovery-retry', {
    connection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 100,
    },
});

// ─── Nightly Aggregation Queue ───────────────────────────
// CRON job fires at midnight every day, aggregates per-provider
// booking outcomes into ProviderMetric rows and warms the cache.
export const nightlyAggregationQueue = new Queue('nightly-aggregation', {
    connection,
    defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
    },
});

// ─── ML Data Collection Queue ────────────────────────────
// Triggered after every COMPLETED / FAILED / CANCELLED booking.
// Writes a MLTrainingData row for future model training.
export const mlDataQueue = new Queue('ml-data-collection', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 200,
    },
});

// ─── SMS Dispatch Queue ──────────────────────────────────
// Jobs are added by auth.controller.ts immediately after storing
// the OTP in Redis. The worker handles delivery (mock in dev,
// real Twilio in production) with 3 automatic retries.
export const smsQueue = new Queue('sms-dispatch', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 200,
    },
});
