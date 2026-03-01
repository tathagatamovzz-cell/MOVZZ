import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.middleware';
import { presignUpload, saveProfilePhoto, getMe } from '../controllers/upload.controller';

const router = Router();

router.use(authenticateUser);

router.post('/presign',      presignUpload);
router.put('/users/me/photo', saveProfilePhoto);
router.get('/users/me',       getMe);

export default router;
