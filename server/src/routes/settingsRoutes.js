import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/miscControllers.js';
import validate from '../validators/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const settingsPayload = z.union([
  z.object({ settings: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])) }),
  z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
]);

router.get('/', requireAuth, requireRole('admin'), controller.getSettings);
router.put('/', requireAuth, requireRole('admin'), validate(settingsPayload), controller.updateSettings);

export default router;
