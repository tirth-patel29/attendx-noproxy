import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { pool, checkDbHealth } from './utils/db';
import { metronomeService } from './services/metronome';
import { ensureDefaultAdmin } from './services/bootstrap';
import { requireApiKey } from './utils/apiKey';
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
// Protected by HTTP Basic auth using the configured admin credentials, so the
// documentation surface is password-protected like the admin console.
// ---------------------------------------------------------------------------
import fs from 'fs';
import path from 'path';

function docsBasicAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="API docs"');
    return res.status(401).json({ error: 'auth required' });
  }
  try {
    const cred = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const sep = cred.indexOf(':');
    const user = cred.slice(0, sep);
    const pass = cred.slice(sep + 1);
    if (user === config.admin.email && pass === config.admin.password) {
      return next();
    }
  } catch (err) {
    /* fallthrough to 401 */
  }
  return res.status(401).json({ error: 'invalid credentials' });
}

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Attendance Gateway API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
<style>html{box-sizing:border-box;overflow:auto}*,*:before,*:after{box-sizing:inherit}body{margin:0;background:#fafafa}</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
window.onload = function () {
  window.ui = SwaggerUIBundle({
    url: '/openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list'
  });
};
</script>
</body>
</html>`;

app.get('/openapi.json', docsBasicAuth, (_req, res) => {
  try {
    const spec = fs.readFileSync(path.join(process.cwd(), 'openapi.json'), 'utf8');
    res.type('application/json').send(spec);
  } catch (err) {
    res.status(500).json({ error: 'openapi spec unavailable' });
  }
});

app.get('/docs', docsBasicAuth, (_req, res) => {
  res.type('text/html').send(SWAGGER_HTML);
});

// API routes
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

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
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
    } catch (err) {
      console.warn('Could not auto-start metronomes:', err);
    }
  });
}

try {
  startServer();
} catch (err: any) {
  console.error('Failed to start server:', err);
  process.exit(1);
}