import { Router } from 'express';
import * as controller from '../controllers/authController.js';
import validate from '../validators/index.js';
import { registerSchema, loginSchema, changePasswordSchema } from '../validators/schemas.js';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', authenticate, controller.me);

router.get('/sessions', requireAuth, controller.sessions);
router.delete('/sessions/:id', requireAuth, controller.revokeSession);
router.post('/logout-all', requireAuth, controller.logoutAll);
router.post('/change-password', requireAuth, validate(changePasswordSchema), controller.changePassword);

export default router;
