import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { pool, checkDbHealth } from './utils/db';
import { metronomeService } from './services/metronome';
import { tokenCache } from './services/tokenCache';
import { ensureDefaultAdmin } from './services/bootstrap';
import { requireApiKey } from './utils/apiKey';
import { ApiError, sendError, inferErrorCode, normalizeErrorBody } from './utils/apiError';
import { rateLimit } from './utils/rateLimit';
import attendanceRoutes from './routes/attendance';
import authRoutes from './routes/auth';
import studentRoutes from './routes/student';
import adminRouteModule from './routes/admin';

const app = express();
const httpServer = createServer(app);

// Socket.io setup — CORS origin list comes from CORS_ORIGIN (comma-separated).
// Same-origin deployments (nginx proxies /socket.io) are never blocked; this
// governs cross-origin browser clients only.
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Pass io to metronome service for broadcasting
metronomeService.setSocketIO(io);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(config.logLevel === 'debug' ? 'dev' : 'combined'));

// ---------------------------------------------------------------------------
// Standardized error envelope — SAFETY NET.
// Wraps res.json so that EVERY non-2xx response is normalized into:
//   { success:false, error:{ code, message, latency_ms?, details? } }
// Handlers that already send an enveloped body pass through untouched;
// anything else gets its code inferred from the HTTP status.
// ---------------------------------------------------------------------------
app.use((_req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 400) {
      return originalJson(normalizeErrorBody(body, res.statusCode));
    }
    return originalJson(body);
  }) as typeof res.json;
  next();
});

// Health check (no auth)
app.get('/health', async (_req, res) => {
  const dbHealthy = await checkDbHealth();
  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    db: dbHealthy ? 'connected' : 'disconnected',
  });
});

// ---------------------------------------------------------------------------
// API docs — Swagger UI at /docs, spec at /openapi.json.
// Public (read-only) so any consumer can read the reference and build a client.
// The API-key *console* stays locked behind the admin JWT login.
// ---------------------------------------------------------------------------
function loadOpenApiSpec(): { raw: string; json: Record<string, unknown> } | null {
  const candidatePaths = [
    path.resolve(__dirname, '../openapi.json'),
    path.join(process.cwd(), 'openapi.json'),
    path.join(process.cwd(), 'backend', 'openapi.json'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const json = JSON.parse(raw);
        return { raw, json };
      } catch (err) {
        console.warn(`Failed to parse openapi.json at ${p}:`, err);
      }
    }
  }
  return null;
}

const openApiSpec = loadOpenApiSpec();

app.get('/openapi.json', (_req, res) => {
  if (openApiSpec) {
    res.type('application/json').send(openApiSpec.raw);
  } else {
    res.status(500).json({ error: 'openapi spec unavailable' });
  }
});

if (openApiSpec) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec.json));
} else {
  console.warn('Could not load openapi.json for Swagger UI docs.');
}

// API routes
app.use('/api/v1', rateLimit()); // broad abuse guard -> 429 ERR_RATE_LIMIT
app.use('/api/v1', attendanceRoutes);
app.use('/api/v1/auth', authRoutes);
// Student client (the APK) is gated by a shared client API key
// (X-Api-Key header). Per-user auth inside /student still applies on top.
app.use('/api/v1/student', requireApiKey, studentRoutes);

// Admin console
//   POST /api/v1/admin/login   -> public (admin auth)
//   ALL  /api/v1/admin/*       -> requireAdmin (JWT role 'admin')
app.use('/api/v1/admin', adminRouteModule.adminPublicRouter);
app.use('/api/v1/admin', adminRouteModule.requireAdmin, adminRouteModule.adminRouter);

// Socket.io connection handling
io.on('connection', (socket: Socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Join session room for token broadcasts
  socket.on('join:session', (sessionUuid: string) => {
    if (typeof sessionUuid === 'string' && sessionUuid.length === 36) {
      socket.join(`session:${sessionUuid}`);
      console.log(`Socket ${socket.id} joined session:${sessionUuid}`);
    }
  });

  socket.on('leave:session', (sessionUuid: string) => {
    if (typeof sessionUuid === 'string') {
      socket.leave(`session:${sessionUuid}`);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
  });

  socket.on('error', (err) => {
    console.error(`Socket error ${socket.id}:`, err);
  });
});

// Error handling middleware — always returns the standardized envelope.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);

  // Explicit thrown ApiError carries status + semantic code.
  if (err instanceof ApiError) {
    sendError(res, err.status, err.code, err.message, {
      details: err.details,
      latencyMs: err.latencyMs,
    });
    return;
  }

  const anyErr = err as any;
  const status = typeof anyErr?.statusCode === 'number' ? anyErr.statusCode : 500;
  const safe = status >= 400 && status < 600 ? status : 500;
  sendError(res, safe, inferErrorCode(safe), 'Internal server error', {
    ...(config.nodeEnv === 'development' && err.message
      ? { details: { dev_message: err.message } }
      : {}),
  });
});

// 404 handler — standardized envelope
app.use((_req, res) => {
  sendError(res, 404, 'ERR_NOT_FOUND', 'Requested resource or session does not exist.');
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
  
  // Stop all metronomes
  metronomeService.stopAll();
  
  // Close Socket.io
  io.close(() => {
    console.log('Socket.io closed');
  });
  
  // Close HTTP server
  httpServer.close(async () => {
    console.log('HTTP server closed');
    
    // Close DB pool
    await pool.end();
    console.log('Database pool closed');
    
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function startServer() {
  // Reliable admin initialization (env-driven upsert; see services/bootstrap.ts)
  try {
    await ensureDefaultAdmin();
  } catch (err) {
    console.error('Admin bootstrap failed (continuing):', err);
  }

  httpServer.listen(config.port, async () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Attendance Backend — Zero-Trust Cryptographic Gateway       ║
║  Port: ${config.port}                                               ║
║  Env: ${config.nodeEnv}                                           ║
║  DB: ${config.db.host}:${config.db.port}/${config.db.database}                    ║
╚══════════════════════════════════════════════════════════════╝
    `);

    // Auto-start metronomes for active sessions on boot
    try {
      const activeSessions = await pool.query(
        `SELECT session_uuid FROM course_sessions WHERE is_active = TRUE`
      );
      for (const row of activeSessions.rows) {
        await metronomeService.startSession(row.session_uuid);
      }
      console.log(`Auto-started metronomes for ${activeSessions.rows.length} active sessions`);

      // Warm the in-memory token cache so the very first claims of a restored
      // session hit memory instead of cold Postgres reads.
      try {
        const activeTokens = await pool.query(
          `SELECT session_uuid, token_val, created_at_epoch, expires_at_epoch
           FROM active_tokens WHERE expires_at_epoch > $1`,
          [Date.now()]
        );
        tokenCache.hydrate(activeTokens.rows);
        console.log(`Hydrated token cache with ${activeTokens.rows.length} live tokens`);
      } catch (cacheErr) {
        console.warn('Could not hydrate token cache:', cacheErr);
      }
    } catch (err) {
      console.warn('Could not auto-start metronomes:', err);
    }

    // DB maintenance cron: clean up expired tokens and used crypto challenges
    // every 5 minutes to prevent unbounded table growth on the 8GB instance.
    const DB_MAINTENANCE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    setInterval(async () => {
      try {
        const r = await pool.query(`SELECT run_db_maintenance() AS result`);
        if (config.logLevel === 'debug') {
          console.log(`[DB Maintenance] ${r.rows[0]?.result}`);
        }
      } catch (err) {
        // Function may not exist yet (migration not applied); silently skip.
      }
    }, DB_MAINTENANCE_INTERVAL_MS);
    console.log(`DB maintenance cron scheduled every ${DB_MAINTENANCE_INTERVAL_MS / 1000}s`);
  });
}

try {
  startServer();
} catch (err: any) {
  console.error('Failed to start server:', err);
  process.exit(1);
}