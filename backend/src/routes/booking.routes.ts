import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.middleware';
import {
    createBookingHandler,
    getBookingHandler,
    getUserBookingsHandler,
    cancelBookingHandler,
    getUserCreditsHandler,
} from '../controllers/booking.controller';

const router = Router();

// All booking routes require authentication
router.use(authenticateUser);

// ─── Booking Endpoints ──────────────────────────────────

router.post('/', createBookingHandler);                    // Create booking
router.get('/', getUserBookingsHandler);                   // List user's bookings
router.get('/credits', getUserCreditsHandler);             // Get user credits
router.get('/:id', getBookingHandler);                     // Get booking status
router.post('/:id/cancel', cancelBookingHandler);          // Cancel booking

export default router;
