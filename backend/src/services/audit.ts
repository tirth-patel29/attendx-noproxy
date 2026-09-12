// src/services/audit.ts
// ============================================================================
// CENTRALIZED AUDIT LOGGING SERVICE
// ----------------------------------------------------------------------------
// Writes forensics events to the append-only audit_logs table.
// Failures are logged to console.error but do not interrupt the primary flow.
// ============================================================================

import { query } from '../utils/db';

export interface AuditLogOptions {
  sessionUuid?: string | null;
  sourceIp?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  async log(
    eventType: string,
    actorUuid: string | null,
    payload: Record<string, unknown>,
    options?: AuditLogOptions
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO audit_logs (event_type, actor_uuid, session_uuid, payload, source_ip, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          eventType,
          actorUuid,
          options?.sessionUuid ?? null,
          JSON.stringify(payload),
          options?.sourceIp ?? null,
          options?.userAgent ?? null,
        ]
      );
    } catch (err) {
      console.error('Audit log write failed:', err);
    }
  }
}

export const auditService = new AuditService();
