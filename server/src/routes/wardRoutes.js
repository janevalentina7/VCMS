import { Router } from 'express';
import * as controller from '../controllers/miscControllers.js';
import validate from '../validators/index.js';
import { wardSchema } from '../validators/schemas.js';
import { authenticate, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, controller.listWards);
router.post('/', requireAuth, requireRole('admin'), validate(wardSchema), controller.createWard);
router.put('/:id', requireAuth, requireRole('admin'), validate(wardSchema.partial()), controller.updateWard);

export default router;
