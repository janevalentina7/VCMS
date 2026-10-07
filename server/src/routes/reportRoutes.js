import { Router } from 'express';
import * as controller from '../controllers/miscControllers.js';
import validate from '../validators/index.js';
import { reportQuerySchema } from '../validators/schemas.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireRole('admin'), validate(reportQuerySchema, 'query'), controller.getReport);
router.get('/pdf', requireRole('admin'), validate(reportQuerySchema, 'query'), controller.downloadReportPdf);

export default router;
