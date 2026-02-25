/**
 * ═══════════════════════════════════════════════════════════
 *  RIDE SEARCH CONTROLLER — DEPRECATED AGGREGATOR
 * ═══════════════════════════════════════════════════════════
 *
 *  This controller previously contained a parallel quote
 *  system with hardcoded Uber/Ola/Rapido simulated data and
 *  its own scoring algorithm that bypassed the provider
 *  scoring engine entirely.
 *
 *  It has been replaced by:
 *    POST /api/v1/quotes  →  quotes.controller.ts
 *    POST /api/v1/bookings → booking.controller.ts
 *
 *  The handlers below are kept as thin shims to avoid
 *  breaking any existing route registrations while the
 *  routes file is updated to point to the new controllers.
 *  Once routes/ride.routes.ts is updated, this file can
 *  be deleted entirely.
 *
 *  DO NOT add business logic here. DO NOT revive the
 *  simulation. Any new quote or booking logic goes in
 *  quotes.controller.ts and booking.controller.ts.
 * ═══════════════════════════════════════════════════════════
 */

import { Request, Response } from 'express';

// ─── Deprecated: Search Rides ───────────────────────────
// Previously generated simulated rides with hardcoded
// Uber/Ola/Rapido data. Now redirects callers to the
// canonical quotes endpoint.

export async function searchRidesHandler(req: Request, res: Response): Promise<void> {
    res.status(410).json({
        success: false,
        error: 'This endpoint is deprecated. Use POST /api/v1/quotes instead.',
        replacement: '/api/v1/quotes',
    });
}

// ─── Deprecated: Select Estimate ───────────────────────
// Previously returned a fake booking ID without touching
// the database. Now redirects callers to the real booking
// endpoint which persists to PostgreSQL and runs the
// state machine.

export async function selectEstimateHandler(req: Request, res: Response): Promise<void> {
    res.status(410).json({
        success: false,
        error: 'This endpoint is deprecated. Use POST /api/v1/bookings instead.',
        replacement: '/api/v1/bookings',
    });
}

// ─── Deprecated: Namma Yatri Status ────────────────────
// Was a stub returning empty data. Namma Yatri integration
// is not planned for MVP. Kept as 410 for clarity.

export async function nyBookingStatusHandler(req: Request, res: Response): Promise<void> {
    res.status(410).json({
        success: false,
        error: 'Namma Yatri integration is not available.',
    });
}