import { Router } from 'express';
import * as controller from '../controllers/userController.js';
import validate from '../validators/index.js';
import {
  userCreateSchema,
  userUpdateSchema,
  userQuerySchema,
  profileUpdateSchema,
  notificationPreferencesSchema,
} from '../validators/schemas.js';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { imageUpload, processImageUpload } from '../middleware/upload.js';

const router = Router();

router.use(requireAuth);

// Self-service (any authenticated role) - declared before /:id
router.get('/me/preferences', controller.getPreferences);
router.put('/me/preferences', validate(notificationPreferencesSchema), controller.updatePreferences);
router.put('/me/profile', validate(profileUpdateSchema), controller.updateProfile);
router.post('/me/avatar', imageUpload('avatar'), processImageUpload('avatars', { maxWidth: 512, quality: 80 }), controller.uploadAvatar);
router.get('/me/sessions', controller.sessionsOf);

// Officer directory: administrators and citizens may need it for assignment / display
router.get('/officers', requireRole('admin', 'officer'), controller.officers);

// Administrative user management
router.get('/', requireRole('admin'), validate(userQuerySchema, 'query'), controller.list);
router.post('/', requireRole('admin'), validate(userCreateSchema), controller.create);
router.get('/stats', requireRole('admin'), controller.stats);
router.get('/:id', controller.get);
router.put('/:id', requireRole('admin'), validate(userUpdateSchema), controller.update);
router.patch('/:id/status', requireRole('admin'), validate(z.object({ status: z.enum(['active', 'inactive', 'suspended']) })), controller.setStatus);
router.delete('/:id', requireRole('admin'), controller.remove);

export default router;
