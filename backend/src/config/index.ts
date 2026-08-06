import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database (Supabase/PostgreSQL)
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },

  // Metronome settings
  metronome: {
    intervalMs: 3000,
    tokenLength: 6,
    tokenCharset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    lookaheadTokens: 2, // mint next N tokens ahead
  },

  // Judge settings
  judge: {
    maxLatencyMs: 250, // 250ms kill window (Cristian's Algorithm tolerance)
    tokenValidityWindowMs: 5000, // token expires after 5s
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};