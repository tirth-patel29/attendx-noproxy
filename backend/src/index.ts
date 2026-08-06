import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { pool, checkDbHealth } from './utils/db';
import { metronomeService } from './services/metronome';
import attendanceRoutes from './routes/attendance';
import authRoutes from './routes/auth';

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.corsOrigin,
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
  origin: config.corsOrigin,
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

// API routes
app.use('/api/v1', attendanceRoutes);
app.use('/api/v1/auth', authRoutes);

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
function startServer() {
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