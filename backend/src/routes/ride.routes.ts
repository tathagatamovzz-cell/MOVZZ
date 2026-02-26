/**
 * ═══════════════════════════════════════════════════════════
 *  RIDE ROUTES — DEPRECATED
 * ═══════════════════════════════════════════════════════════
 *
 *  These routes previously handled ride search and selection
 *  via ride.controller.ts, which contained a parallel quote
 *  system with hardcoded provider simulation.
 *
 *  All functionality has moved to:
 *    POST /api/v1/quotes    → quotes.controller.ts
 *    POST /api/v1/bookings  → booking.controller.ts
 *
 *  The routes below are kept as thin 410 shims so existing
 *  clients get a clear migration message instead of a 404.
 *  Once all clients have migrated, this file and
 *  ride.controller.ts can be deleted.
 * ═══════════════════════════════════════════════════════════
 */

import { Router } from 'express';
import {
    searchRidesHandler,
    selectEstimateHandler,
} from '../controllers/ride.controller';

const router = Router();

// Both handlers return 410 Gone with replacement endpoint info
router.post('/search', searchRidesHandler);
router.post('/select', selectEstimateHandler);

export default router;
