import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../../utils/db';
import { generateApiKey } from '../../utils/apiKey';
import { auditService } from '../../services/audit';

export const adminApiKeysRouter = Router();

// GET /api-keys
adminApiKeysRouter.get('/api-keys', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(
      `SELECT key_uuid, label, prefix, status, created_at, last_used_at
       FROM api_keys ORDER BY created_at DESC`
    );
    res.json({ keys: r.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api-keys
adminApiKeysRouter.post('/api-keys', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = z.object({ label: z.string().min(1).max(64) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Invalid label' });
  try {
    const { raw, hash, prefix } = generateApiKey();
    const actor = (req as any).admin?.sub || 'admin';
    const ins = await query(
      `INSERT INTO api_keys (key_hash, prefix, label, created_by) VALUES ($1,$2,$3,$4)
       RETURNING key_uuid, created_at`,
      [hash, prefix, parsed.data.label, actor]
    );
    await auditService.log('API_KEY_CREATE', actor, { label: parsed.data.label, key_uuid: ins.rows[0].key_uuid, prefix });
    res.status(201).json({
      key_uuid: ins.rows[0].key_uuid,
      label: parsed.data.label,
      prefix,
      api_key: raw, // shown exactly once
      created_at: ins.rows[0].created_at,
      note: 'Store this key now — it cannot be retrieved again.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api-keys/:uuid/revoke
adminApiKeysRouter.post('/api-keys/:uuid/revoke', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(
      `UPDATE api_keys SET status = 'revoked' WHERE key_uuid = $1 RETURNING key_uuid`,
      [req.params.uuid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Key not found' });
    const actor = (req as any).admin?.sub || 'admin';
    await auditService.log('API_KEY_REVOKE', actor, { key_uuid: req.params.uuid });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
