import { Router } from 'express';
import { ProviderController } from '../controllers/provider.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const providerController = new ProviderController();

// Public routes
router.get('/available', providerController.getAvailableProviders);

// Protected routes
router.use(authenticate);
router.post('/estimate', providerController.getEstimate);
router.get('/compare', providerController.compareProviders);

export default router;
