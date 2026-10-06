import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/miscControllers.js';
import validate from '../validators/index.js';
import { notificationQuerySchema } from '../validators/schemas.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/', validate(notificationQuerySchema, 'query'), controller.listNotifications);
router.get('/unread-count', controller.unreadCount);
router.put('/read-all', controller.markAllNotificationsRead);
router.put('/:id/read', validate(z.object({ isRead: z.boolean().optional() })), controller.markNotificationRead);

export default router;
