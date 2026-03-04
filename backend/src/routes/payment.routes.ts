import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.middleware';
import { createLinkHandler, verifyPaymentHandler } from '../controllers/payment.controller';

const router = Router();

// All payment routes require authentication
router.use(authenticateUser);

router.post('/create-link', createLinkHandler);   // Create Razorpay Payment Link → returns shortUrl
router.post('/verify', verifyPaymentHandler);      // Verify payment after redirect back from Razorpay

export default router;
