import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/miscControllers.js';
import validate from '../validators/index.js';
import { categorySchema } from '../validators/schemas.js';
import { authenticate, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, controller.listCategories);
router.post('/', requireAuth, requireRole('admin'), validate(categorySchema), controller.createCategory);
router.put('/:id', requireAuth, requireRole('admin'), validate(categorySchema.partial()), controller.updateCategory);
router.patch('/:id/status', requireAuth, requireRole('admin'), validate(z.object({ active: z.boolean() })), controller.setCategoryStatus);
router.delete('/:id', requireAuth, requireRole('admin'), controller.deleteCategory);

export default router;
