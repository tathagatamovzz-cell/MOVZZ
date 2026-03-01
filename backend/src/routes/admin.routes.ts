import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.middleware';
import {
    getDashboard,
    manualConfirmBooking,
    getEscalatedBookings,
    getActiveBookings,
    listProviders,
    createProvider,
    updateProvider,
    pauseProvider,
    resumeProvider,
    getProviderMetrics,
    getSystemMetrics,
} from '../controllers/admin.controller';

const router = Router();

// All admin routes require authentication
// TODO: Add admin role check middleware
router.use(authenticateUser);

// ─── Dashboard ──────────────────────────────────────────
router.get('/dashboard', getDashboard);
router.get('/metrics', getSystemMetrics);

// ─── Booking Management ─────────────────────────────────
router.get('/bookings/active', getActiveBookings);
router.get('/bookings/escalated', getEscalatedBookings);
router.post('/bookings/:bookingId/confirm', manualConfirmBooking);

// ─── Provider Management ────────────────────────────────
router.get('/providers', listProviders);
router.post('/providers', createProvider);
router.put('/providers/:id', updateProvider);
router.post('/providers/:id/pause', pauseProvider);
router.post('/providers/:id/resume', resumeProvider);
router.get('/providers/:id/metrics', getProviderMetrics);

export default router;
