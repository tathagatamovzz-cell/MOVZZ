import { Router } from 'express';
import express from 'express';
import { authenticateUser } from '../middleware/auth.middleware';
import { createLinkHandler, verifyPaymentHandler, webhookHandler } from '../controllers/payment.controller';

const router = Router();

// ─── Webhook (no auth — Razorpay server-to-server) ──────
// MUST use express.raw() to preserve raw Buffer for HMAC signature verification.
// Registered BEFORE authenticateUser so it doesn't require a JWT.
router.post('/webhook', express.raw({ type: 'application/json' }), webhookHandler);

// ─── Authenticated payment routes ───────────────────────
router.use(authenticateUser);
router.post('/create-link', createLinkHandler);   // Create Razorpay Payment Link → returns shortUrl
router.post('/verify', verifyPaymentHandler);      // Verify payment after redirect back from Razorpay

export default router;
