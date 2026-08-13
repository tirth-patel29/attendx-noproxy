import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  max: config.db.max,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
  connectionTimeoutMillis: config.db.connectionTimeoutMillis,
  // Hard guards against DB lockups: no single query may run for >4s nor hold a
  // row lock >2s (blocks the classic "one slow claim pins the table" failure).
  options: '-c statement_timeout=4000 -c lock_timeout=2000',
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (config.logLevel === 'debug') {
    console.log('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
  }
  return res;
}

export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);

  // Optional: add query timing wrapper
  const boundQuery = client.query.bind(client);
  client.query = ((text: string, values?: any[]) => {
    const start = Date.now();
    const p = boundQuery(text, values);
    p.then(() => {
      const duration = Date.now() - start;
      if (config.logLevel === 'debug') {
        console.log('Client query', { duration, text: String(text).substring(0, 100) });
      }
    }).catch(() => {});
    return p;
  }) as typeof client.query;

  client.release = () => {
    client.query = originalQuery;
    return originalRelease();
  };

  return client;
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Health check
export async function checkDbHealth(): Promise<boolean> {
  try {
    const res = await query('SELECT 1 as health');
    return res.rows[0]?.health === 1;
  } catch {
    return false;
  }
}