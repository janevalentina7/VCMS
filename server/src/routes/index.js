/** API router. Every feature area is mounted under /api/<area>. */
import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import complaintRoutes from './complaintRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import wardRoutes from './wardRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import reportRoutes from './reportRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import publicRoutes from './publicRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/complaints', complaintRoutes);
router.use('/categories', categoryRoutes);
router.use('/wards', wardRoutes);
router.use('/notifications', notificationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/reports', reportRoutes);
router.use('/settings', settingsRoutes);
router.use('/public', publicRoutes);

router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Village Complaint Management System API',
      version: '1.0.0',
      docs: '/api/health',
      endpoints: [
        'POST   /api/auth/register',
        'POST   /api/auth/login',
        'POST   /api/auth/refresh',
        'POST   /api/auth/logout',
        'GET    /api/auth/me',
        'GET    /api/users',
        'POST   /api/users',
        'GET    /api/users/officers',
        'GET    /api/complaints',
        'POST   /api/complaints',
        'GET    /api/complaints/:id',
        'PUT    /api/complaints/:id',
        'DELETE /api/complaints/:id',
        'POST   /api/complaints/:id/approve',
        'POST   /api/complaints/:id/assign',
        'PUT    /api/complaints/:id/status',
        'POST   /api/complaints/:id/remarks',
        'GET    /api/complaints/:id/history',
        'GET    /api/complaints/track',
        'GET    /api/categories',
        'GET    /api/wards',
        'GET    /api/notifications',
        'PUT    /api/notifications/:id/read',
        'GET    /api/analytics/dashboard',
        'GET    /api/analytics/categories',
        'GET    /api/analytics/monthly',
        'GET    /api/analytics/status',
        'GET    /api/analytics/wards',
        'GET    /api/reports',
        'GET    /api/reports/pdf',
      ],
    },
  });
});

export default router;
