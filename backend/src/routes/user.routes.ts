import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const userController = new UserController();

// All user routes require authentication
router.use(authenticate);

router.get('/profile', userController.getProfile);
router.patch('/profile', userController.updateProfile);
router.get('/saved-locations', userController.getSavedLocations);
router.post('/saved-locations', userController.addSavedLocation);
router.delete('/saved-locations/:locationId', userController.deleteSavedLocation);

export default router;
