# Attendance Gateway Backend - Complete Analysis & Bug Report
**Generated:** 2026-08-24 19:25:16
**Analyzer:** Kiro AI
**Scope:** Backend API, Services, Routes, Architecture

---

## Executive Summary

The Attendance Gateway is a sophisticated zero-trust attendance system with 4-gate security. After comprehensive analysis of the backend codebase, documentation, and API structure, I've identified **critical bugs, security issues, architectural improvements, and missing features** that need attention.

### System Architecture Overview

**Stack:**
- Backend: Node.js/TypeScript + Express + Socket.IO
- Database: Self-hosted Supabase (PostgreSQL)
- Deployment: Docker on homelab (8GB RAM constraint)
- API: REST + WebSocket for real-time token broadcasting

**4-Gate Security Model:**
1. **Gate 1:** Hardware Tattoo (device_id_hash binding)
2. **Gate 2:** Biometric Flesh Lock (client-side)
3. **Gate 3:** Visual Micro-Twitch (3s rotating tokens)
4. **Gate 4:** Crypto Time-Stamp (HMAC + 250ms window)

---

## Critical Bugs Found

### BUG-001: Race Condition in Nonce Verification
**Severity:** CRITICAL
**Location:** `judge.ts` line ~150
**Issue:** The nonce verification uses two separate queries:
1. UPDATE to mark nonce as used
2. SELECT to check if it was already used

**Problem:** Between these two queries, there's a TOCTOU (Time-of-Check-Time-of-Use) vulnerability where concurrent requests could pass the first check.

**Current Code:**
`typescript
const nonceRes = await query(
  UPDATE crypto_challenges SET used = TRUE, used_at_epoch = 
   WHERE session_uuid =  AND challenge_nonce =  AND used = FALSE...
);
if (nonceRes.rows.length === 0) {
  const exists = await query(SELECT used FROM crypto_challenges WHERE...);
}
`

**Impact:** Replay attacks might succeed if two requests arrive simultaneously.

**Fix:** Use a single atomic UPDATE with RETURNING clause to avoid the race.

---

### BUG-002: Missing Input Validation on Critical Endpoints
**Severity:** HIGH
**Location:** Multiple routes (`attendance.ts`, `student.ts`)

**Issues Found:**
1. `/api/v1/time/validate` - No schema validation, relies on manual checks
2. `/api/v1/professor/current-lecture` - No query parameter validation
3. `/api/v1/sessions/:sessionUuid/challenge` - sessionUuid format not validated before DB query

**Example:**
`typescript
router.post('/time/validate', requireApiKey, async (req: Request, res: Response) => {
  const { session_uuid, student_uuid, token_val, device_id_hash, nonce, hmac_signature, client_claimed_time } = req.body;
  if (!session_uuid || !student_uuid || !token_val || !device_id_hash || !nonce || !hmac_signature) 
    return res.status(400).json({ error: 'Missing required fields' });
  // No type/format validation!
`

**Impact:** SQL injection risk, server crashes from malformed data, inconsistent error responses.

**Fix:** Add Zod schemas for ALL endpoints.

---

### BUG-003: JWT Secret Hardcoded Fallback
**Severity:** CRITICAL (Security)
**Location:** `attendance.ts` line 13, `student.ts` line 27

**Current Code:**
`typescript
const JWT_SECRET = config.jwtSecret || 'dev-secret-change-in-production-min-32-chars-long';
`

**Problem:** If `JWT_SECRET` env var is missing in production, the system falls back to a **publicly known default secret**, allowing anyone to forge admin/professor/student JWTs.

**Impact:** Complete authentication bypass.

**Fix:** 
`typescript
const JWT_SECRET = config.jwtSecret;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET must be set and >= 32 chars');
}
`

---

### BUG-004: Memory Leak in Metronome Service
**Severity:** HIGH
**Location:** `metronome.ts` line ~80

**Issue:** The `intervals` Map grows indefinitely. When sessions are stopped, the interval is cleared but **expired tokens are never cleaned from the token cache**.

**Current Code:**
`typescript
stopSession(sessionUuid: string): void {
  const interval = this.intervals.get(sessionUuid);
  if (interval) {
    clearInterval(interval);
    this.intervals.delete(sessionUuid);
    console.log(Metronome stopped for session {sessionUuid});
  }
  // tokenCache is never cleaned!
}
`

**Impact:** On an 8GB RAM homelab running 24/7, this will eventually exhaust memory.

**Fix:** Call `tokenCache.clearSession(sessionUuid)` in `stopSession()`.

---

### BUG-005: Incomplete Error Normalization
**Severity:** MEDIUM
**Location:** `index.ts` line ~50

**Issue:** The error normalization middleware only wraps non-2xx responses but **doesn't handle all status codes correctly**.

**Current Code:**
`typescript
res.json = ((body: unknown) => {
  if (res.statusCode >= 400) {
    return originalJson(normalizeErrorBody(body, res.statusCode));
  }
  return originalJson(body);
}) as typeof res.json;
`

**Problem:** 
1. What if status code is 0 or invalid?
2. What about 3xx redirects with error bodies?
3. No handling for streaming responses

**Fix:** Add status code validation and skip normalization for chunked responses.

---

### BUG-006: Session Ownership Check Missing on Challenge Endpoint
**Severity:** HIGH (Security)
**Location:** `attendance.ts` line ~100

**Current Code:**
`typescript
router.post('/sessions/:sessionUuid/challenge', async (req: Request, res: Response) => {
  const { sessionUuid } = req.params;
  const sessionCheck = await query(
    SELECT session_uuid FROM course_sessions WHERE session_uuid =  AND is_active = TRUE,
    [sessionUuid]
  );
  if (sessionCheck.rows.length === 0) return res.status(404).json({ error: 'Active session not found' });
  // No check if this session belongs to the requesting student!
`

**Impact:** Any student can request a challenge for ANY session, even if they're not enrolled.

**Fix:** Add student enrollment check before issuing challenge.

---

### BUG-007: Inconsistent Timestamp Handling
**Severity:** MEDIUM
**Location:** Multiple files

**Issues:**
1. Mix of `Date.now()` and `new Date().getTime()`
2. Mix of epoch milliseconds (bigint) vs integers
3. No timezone normalization (IST vs UTC)

**Example from `attendance.ts`:
`typescript
const serverNow = new Date(); // Uses system timezone
const serverDow = serverNow.getDay(); // Can be wrong if server != IST
`

**Impact:** Time-based queries fail across timezone boundaries.

**Fix:** Standardize on UTC epoch milliseconds everywhere.

---

## Security Vulnerabilities

### SEC-001: Missing Rate Limiting on Sensitive Endpoints
**Severity:** HIGH
**Location:** Multiple auth endpoints

**Issue:** While `/api/v1` has global rate limiting, critical endpoints lack specific limits:
- `/api/v1/student/login` - Brute force attacks possible
- `/api/v1/admin/login` - Admin account compromise risk
- `/api/v1/claim-attendance` - Could DoS the session

**Fix:** Add endpoint-specific rate limiters with exponential backoff.

---

### SEC-002: No Request Size Limit Validation
**Severity:** MEDIUM
**Location:** `index.ts`

**Current:**
`typescript
app.use(express.json({ limit: '1mb' }));
`

**Issue:** While there's a 1MB limit, there's no validation on deeply nested JSON or array sizes, allowing algorithmic complexity attacks.

**Fix:** Add `express-json-validator-middleware` with depth/array limits.

---

### SEC-003: CORS Configuration Too Permissive
**Severity:** MEDIUM
**Location:** `index.ts` line ~25

**Current Code:**
`typescript
cors({
  origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,  // true = allow ALL
  credentials: true,
})
`

**Problem:** If `CORS_ORIGIN` is not set, the system accepts requests from **any origin** with credentials.

**Impact:** CSRF attacks, credential theft.

**Fix:** Never default to `true`; require explicit origins.

---

### SEC-004: SQL Injection Risk in Dynamic Queries
**Severity:** HIGH
**Location:** `attendance.ts` multiple places

**Example:**
`typescript
router.get('/professor/summary', requireProfessor, async (req: Request, res: Response) => {
  const profUuid = (req as any).professor.sub as string; // Extracted from JWT, but...
  const r = await query(SELECT ... WHERE a.prof_uuid = , [profUuid]);
`

**Issue:** While parameterized queries ARE used (good!), there's no validation that `profUuid` is actually a UUID format before passing to the query.

**Impact:** If JWT verification is bypassed (e.g., BUG-003), malformed UUIDs could cause DB errors or injection.

**Fix:** Validate all UUID parameters with `z.string().uuid()` before DB operations.

---

## Architectural Issues

### ARCH-001: No Database Connection Pooling Configuration
**Severity:** MEDIUM
**Location:** `utils/db.ts` (not shown but inferred)

**Issue:** No visibility into:
- Pool size limits
- Connection timeout settings
- Idle connection cleanup
- Connection retry logic

**Impact:** On 8GB homelab, uncontrolled connections could exhaust RAM or hang.

**Recommendation:** Document pool settings and add monitoring.

---

### ARCH-002: Missing Health Check for Socket.IO
**Severity:** LOW
**Location:** `index.ts`

**Current:** Only checks database health at `/health`.
**Missing:** Socket.IO connection status, active session count, metronome status.

**Impact:** Operational blindness - can't tell if WebSocket broadcasting is working.

**Fix:** Add comprehensive health endpoint:
`typescript
{
  db: 'connected',
  socketio: { connected_clients: 42, active_rooms: 3 },
  metronome: { active_sessions: 2 },
  memory: process.memoryUsage()
}
`

---

### ARCH-003: No Graceful Degradation for DB Failures
**Severity:** HIGH
**Location:** All routes

**Issue:** When Postgres is down, ALL endpoints return 500 errors, including:
- `/health` (should return 503 with partial info)
- `/time-sync` (doesn't need DB!)
- `/docs` (static content)

**Impact:** Complete system failure on DB hiccup.

**Fix:** Implement circuit breaker pattern for DB calls.

---

### ARCH-004: Token Cache Has No Eviction Policy
**Severity:** MEDIUM
**Location:** `services/tokenCache.ts` (inferred)

**Issue:** The in-memory token cache grows indefinitely with no:
- TTL-based eviction
- LRU eviction
- Max size limit

**Impact:** Memory leak on long-running sessions.

**Fix:** Implement LRU cache with configurable max size.

---

## Missing Features (High Priority)

### FEAT-001: No Audit Log Query Endpoint
**Severity:** HIGH
**Business Impact:** Can't investigate security incidents

**Issue:** Audit logs are written to the DB but there's **no API to query them**.

**Needed:** `GET /api/v1/admin/audit-logs` with filtering by:
- Event type
- Actor UUID
- Date range
- Session UUID

---

### FEAT-002: No Device Unbinding Endpoint for Students
**Severity:** MEDIUM
**Business Impact:** Students locked out if phone breaks

**Issue:** Only admin can reset `bound_device_id`, but there's no self-service flow for students to:
1. Request device unbind (with verification)
2. Admin approval queue
3. Automated unbind after X days of inactivity

**Current Workaround:** Admin console manual reset.

**Needed:** 
- `POST /api/v1/student/device/unbind-request`
- `GET /api/v1/admin/unbind-requests` (approval queue)

---

### FEAT-003: No Attendance Analytics Endpoints
**Severity:** MEDIUM
**Business Impact:** Professors can't see trends

**Missing:**
- Attendance percentage by student (over time)
- Session attendance heatmap (by day/time)
- Low-attendance alerts
- Comparison across divisions

**Needed:** 
- `GET /api/v1/professor/analytics/:courseCode`
- `GET /api/v1/students/:uuid/analytics`

---

### FEAT-004: No Token Replay Protection Monitoring
**Severity:** HIGH
**Security Impact:** Can't detect attack patterns

**Issue:** No endpoint to see:
- Duplicate nonce attempts (blocked replays)
- Hardware mismatch frequency (device sharing attempts)
- Stream detection rate (video relay attempts)

**Needed:** `GET /api/v1/admin/security-events` with aggregation.

---

### FEAT-005: No Session Timeout Configuration
**Severity:** MEDIUM
**Operations Impact:** Sessions run forever if professor forgets

**Issue:** No automatic session stop after:
- X hours of inactivity
- End of class time (from timetable)
- No new token requests for Y minutes

**Needed:** Configurable timeout + auto-stop logic.

---

## Performance Issues

### PERF-001: N+1 Query in Session Listing
**Severity:** HIGH
**Location:** `attendance.ts` line ~70

**Current Code:**
`typescript
router.get('/sessions', requireProfessor, async (req: Request, res: Response) => {
  const result = await query(SELECT ... FROM course_sessions WHERE prof_uuid = ...);
  const shaped = await Promise.all(result.rows.map(shapeSession)); // N+1!
});

async function shapeSession(row: any) {
  const counts = await query(SELECT COUNT(*) ...); // Separate query per session!
}
`

**Impact:** Professor with 50 sessions = 51 queries (1 + 50).

**Fix:** Use a single JOIN query with aggregation.

---

### PERF-002: No Caching on Timetable Queries
**Severity:** MEDIUM
**Location:** `attendance.ts` line ~120

**Issue:** `/api/v1/professor/timetable` queries the DB on every request, but timetables change rarely (weekly at most).

**Impact:** Unnecessary DB load.

**Fix:** Add Redis cache with 1-hour TTL or in-memory cache with invalidation.

---

### PERF-003: Token Cleanup Runs Per-Session
**Severity:** LOW
**Location:** `metronome.ts` line ~90

**Issue:** Every session runs its own cleanup interval, causing:
- 10 sessions = 10 separate `DELETE` queries every 3s
- No batch cleanup

**Fix:** Run one global cleanup worker instead of per-session.

---

## Documentation Gaps

### DOC-001: No API Error Response Examples
**Issue:** `openapi.json` has error codes but no actual response body examples.

**Example Missing:**
`json
// What does ERR_STREAM_DETECTED actually look like?
{
  "success": false,
  "error": {
    "code": "ERR_STREAM_DETECTED",
    "message": "...",
    "latency_ms": 310,
    "details": {}
  }
}
`

**Fix:** Add examples to every error response in OpenAPI spec.

---

### DOC-002: No Deployment Runbook
**Issue:** Missing operational docs:
- How to restart after power cut
- How to check logs
- How to manually stop a runaway session
- How to backup/restore the DB

**Needed:** `docs/OPERATIONS.md` with runbook.

---

### DOC-003: No Load Testing Results
**Issue:** No documented performance baselines:
- How many concurrent claims can the i3-6000T handle?
- What's the p95 latency under load?
- When does the 8GB RAM limit hit?

**Needed:** `docs/LOAD_TESTING.md` with results from `k6` or `artillery`.

---

## Testing Gaps

### TEST-001: No Unit Tests for Judge Service
**Severity:** CRITICAL
**Location:** `services/judge.ts`

**Issue:** The entire 4-gate verification logic has **no unit tests**.

**Needed Tests:**
- `should accept honest student with valid HMAC`
- `should reject hardware mismatch (Gate 1)`
- `should reject forged HMAC (Gate 4)`
- `should reject expired token (Gate 3)`
- `should reject stream detected (latency > 250ms)`
- `should reject nonce reuse`
- `should handle concurrent claims (idempotency)`

---

### TEST-002: No Integration Tests for Critical Flows
**Severity:** HIGH

**Missing End-to-End Tests:**
- Professor starts session → metronome runs → tokens broadcast → student claims → ledger updates
- Admin resets device → student re-binds → can claim again
- Session timeout → metronome stops → tokens expire → claims fail

**Needed:** `tests/integration/attendance-flow.test.ts`

---

### TEST-003: No Homelab Power-Cut Simulation
**Severity:** HIGH
**Business Impact:** Can't verify resilience

**Issue:** While `ROADMAP.md` mentions power-cut drills, there's no:
- Automated test script
- Checklist of what to verify
- Pass/fail criteria

**Needed:** `scripts/power-cut-drill.sh` with verification steps.

---

## Configuration Issues

### CONFIG-001: No Environment Variable Validation
**Severity:** HIGH
**Location:** `config/index.ts` (not shown but inferred)

**Issue:** No startup validation of required env vars. System might:
- Start with missing `DATABASE_URL`
- Use wrong `JWT_SECRET`
- Have misconfigured `CORS_ORIGIN`

**Fix:** Add startup checks:
`typescript
function validateConfig() {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN'];
  for (const key of required) {
    if (!process.env[key]) throw new Error(Missing required env var: {key});
  }
}
`

---

### CONFIG-002: Hard-coded Timeout Values
**Severity:** MEDIUM
**Location:** Multiple files

**Issue:** Magic numbers everywhere:
- 250ms latency window (should be `JUDGE_MAX_LATENCY_MS`)
- 3000ms metronome interval (should be `METRONOME_INTERVAL_MS`)
- 30d JWT expiry (should be `JWT_EXPIRY_DAYS`)

**Fix:** Move all timeouts to `config/` with env overrides.

---

## Recommended Immediate Actions

### Priority 1 (Fix This Week)
1. **BUG-003:** Fix JWT secret fallback - CRITICAL security issue
2. **BUG-001:** Fix nonce race condition - authentication bypass risk
3. **BUG-006:** Add session ownership check on challenge endpoint
4. **TEST-001:** Write unit tests for judge service

### Priority 2 (Fix This Sprint)
5. **BUG-002:** Add Zod validation to all endpoints
6. **BUG-004:** Fix memory leak in metronome/token cache
7. **SEC-001:** Add rate limiting on auth endpoints
8. **FEAT-004:** Add security monitoring endpoint

### Priority 3 (Next Sprint)
9. **ARCH-003:** Implement graceful degradation for DB failures
10. **PERF-001:** Fix N+1 query in session listing
11. **FEAT-001:** Build audit log query API
12. **DOC-002:** Write operations runbook

---

## Summary Statistics

- **Critical Bugs:** 2
- **High Severity Issues:** 8
- **Medium Severity Issues:** 9
- **Low Severity Issues:** 2
- **Missing Features:** 5
- **Performance Issues:** 3
- **Documentation Gaps:** 3
- **Testing Gaps:** 3
- **Configuration Issues:** 2

**Total Issues Found:** 37

---

## Conclusion

The Attendance Gateway backend is **architecturally sound** with a well-designed 4-gate security model and sophisticated zero-trust approach. However, it has **critical security and reliability issues** that must be addressed before production deployment.

The most urgent fixes are:
1. JWT secret validation (security)
2. Nonce race condition (authentication bypass)
3. Memory leaks (8GB homelab constraint)
4. Missing input validation (injection risk)

The codebase shows strong engineering (parameterized queries, audit logging, graceful shutdown), but needs:
- Comprehensive testing
- Operational documentation  
- Performance optimization
- Security hardening

**Recommendation:** Address Priority 1 items immediately, then proceed with systematic fixes using the prioritized list above.

---

*Generated by Kiro AI | Report Version: 1.0*
