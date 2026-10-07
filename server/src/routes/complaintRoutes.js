import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/complaintController.js';
import validate from '../validators/index.js';
import {
  complaintCreateSchema,
  complaintUpdateSchema,
  complaintQuerySchema,
  statusUpdateSchema,
  remarkSchema,
  assignSchema,
  trackQuerySchema,
} from '../validators/schemas.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { imageUpload, processImageUpload } from '../middleware/upload.js';
import { writeLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.use(requireAuth);

router.get('/', validate(complaintQuerySchema, 'query'), controller.list);
router.get('/stats', controller.stats);
router.get('/track', validate(trackQuerySchema, 'query'), controller.track);

router.post(
  '/',
  writeLimiter,
  imageUpload('image'),
  processImageUpload('complaints'),
  validate(complaintCreateSchema),
  controller.create,
);

router.get('/:id', controller.get);
router.get('/:id/history', controller.history);
router.put('/:id', validate(complaintUpdateSchema), controller.update);
router.post('/:id/approve', requireRole('admin'), validate(z.object({ remarks: z.string().trim().max(2000).optional() })), controller.approve);

router.post(
  '/:id/assign',
  requireRole('admin'),
  validate(assignSchema),
  controller.assign,
);

router.put('/:id/status', requireRole('admin', 'officer'), validate(statusUpdateSchema), controller.changeStatus);
router.post('/:id/remarks', requireRole('admin', 'officer'), validate(remarkSchema), controller.addRemark);
router.delete('/:id', controller.remove);

export default router;
