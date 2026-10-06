/** Lightweight audit trail helper for privileged actions. */
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

export const recordAudit = async ({ userId, action, entity, entityId, meta, ip }) => {
  try {
    await db('audit_logs').insert({
      user_id: userId ?? null,
      action,
      entity: entity ?? null,
      entity_id: entityId != null ? String(entityId) : null,
      meta: meta ? JSON.stringify(meta) : null,
      ip_address: ip ?? null,
      created_at: new Date(),
    });
  } catch (error) {
    logger.warn(`audit log write failed: ${error.message}`);
  }
};

export default recordAudit;
