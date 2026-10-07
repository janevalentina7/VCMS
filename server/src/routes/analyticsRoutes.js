import { Router } from 'express';
import * as controller from '../controllers/miscControllers.js';
import validate from '../validators/index.js';
import { analyticsQuerySchema } from '../validators/schemas.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// Available to every signed-in role - the queries are automatically scoped
// to the caller's visibility (own / assigned / all).
router.get('/dashboard', validate(analyticsQuerySchema, 'query'), controller.analyticsDashboard);
router.get('/summary', validate(analyticsQuerySchema, 'query'), controller.analyticsSummary);
router.get('/categories', validate(analyticsQuerySchema, 'query'), controller.analyticsCategories);
router.get('/monthly', validate(analyticsQuerySchema, 'query'), controller.analyticsMonthly);
router.get('/status', validate(analyticsQuerySchema, 'query'), controller.analyticsStatus);
router.get('/wards', validate(analyticsQuerySchema, 'query'), controller.analyticsWards);
router.get('/priority', validate(analyticsQuerySchema, 'query'), controller.analyticsPriority);
router.get('/recent', controller.analyticsRecent);
router.get('/officers', requireRole('admin'), validate(analyticsQuerySchema, 'query'), controller.analyticsOfficers);
router.get('/officer-summary', requireRole('officer'), controller.officerSummary);
router.get('/citizen-summary', requireRole('citizen'), controller.citizenSummary);

export default router;
