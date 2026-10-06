import { Router } from 'express';
import * as controller from '../controllers/miscControllers.js';
import { ensureCsrfToken } from '../middleware/csrf.js';

const router = Router();

/** Anonymous access: landing page content + branding + CSRF bootstrap. */
router.get('/branding', controller.publicBranding);
router.get('/stats', controller.publicStats);
router.get('/csrf', (req, res) => {
  const token = ensureCsrfToken(req, res);
  res.json({ success: true, data: { csrfToken: token } });
});

export default router;
