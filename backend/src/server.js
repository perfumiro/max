import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const dataDir = path.resolve(workspaceRoot, 'backend', 'data');
const dbPath = path.resolve(dataDir, 'analytics.db');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const app = express();
const PORT = Number(process.env.PORT || 5050);
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-env';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const COOKIE_NAME = process.env.COOKIE_NAME || 'ipordise_admin_token';
const ADMIN_USER = String(process.env.ADMIN_USER || 'admin@ipordise.com').toLowerCase();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const TRUST_PROXY = Number(process.env.TRUST_PROXY || 1);
const ONLINE_WINDOW_MINUTES = Number(process.env.ONLINE_WINDOW_MINUTES || 5);
const DEDUP_WINDOW_SECONDS = Number(process.env.DEDUP_WINDOW_SECONDS || 45);
const CORS_ORIGIN = String(process.env.CORS_ORIGIN || '').trim();

app.set('trust proxy', TRUST_PROXY);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const allowedOrigins = new Set([
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5050',
  'http://127.0.0.1:5050'
]);

if (CORS_ORIGIN) {
  CORS_ORIGIN
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .forEach((origin) => allowedOrigins.add(origin));
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
});

app.use(express.static(workspaceRoot, { extensions: ['html'] }));

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  session_id TEXT,
  ip_address TEXT,
  ip_masked TEXT,
  country TEXT,
  city TEXT,
  page_url TEXT,
  referrer TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  event_type TEXT,
  timestamp INTEGER NOT NULL,
  user_agent TEXT,
  is_returning INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS visitor_last_seen (
  visitor_id TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  total_events INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS admin_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visits_timestamp ON visits(timestamp);
CREATE INDEX IF NOT EXISTS idx_visits_visitor ON visits(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visits_page ON visits(page_url);
CREATE INDEX IF NOT EXISTS idx_visits_country ON visits(country);
`);

const insertVisitStmt = db.prepare(`
INSERT INTO visits (
  visitor_id, session_id, ip_address, ip_masked, country, city, page_url, referrer,
  device_type, browser, os, event_type, timestamp, user_agent, is_returning
) VALUES (
  @visitor_id, @session_id, @ip_address, @ip_masked, @country, @city, @page_url, @referrer,
  @device_type, @browser, @os, @event_type, @timestamp, @user_agent, @is_returning
)
`);

const findLastEventStmt = db.prepare(`
SELECT timestamp FROM visits
WHERE visitor_id = ? AND page_url = ? AND event_type = ?
ORDER BY timestamp DESC
LIMIT 1
`);

const upsertVisitorStmt = db.prepare(`
INSERT INTO visitor_last_seen (visitor_id, first_seen, last_seen, total_events)
VALUES (@visitor_id, @first_seen, @last_seen, 1)
ON CONFLICT(visitor_id) DO UPDATE SET
  last_seen = excluded.last_seen,
  total_events = visitor_last_seen.total_events + 1
`);

const getVisitorSeenStmt = db.prepare('SELECT first_seen, last_seen, total_events FROM visitor_last_seen WHERE visitor_id = ?');

const authCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/'
};

const maskIp = (ipAddress) => {
  if (!ipAddress) return '';
  const ip = String(ipAddress).trim();
  if (ip.includes(':')) {
    const segments = ip.split(':');
    if (segments.length <= 2) return ip;
    return `${segments[0]}:${segments[1]}:****:****`;
  }
  const parts = ip.split('.');
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.***.***`;
};

const normalizePath = (rawUrl) => {
  if (!rawUrl) return '/';
  try {
    const parsed = new URL(rawUrl, 'http://local.internal');
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return String(rawUrl).slice(0, 350);
  }
};

const normalizeReferrer = (referrer) => {
  if (!referrer) return 'direct';
  try {
    const parsed = new URL(referrer);
    return parsed.hostname || 'direct';
  } catch {
    return 'direct';
  }
};

const getIpAddress = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
};

const mapDeviceType = (ua) => {
  if (ua.device?.type === 'tablet') return 'tablet';
  if (ua.device?.type === 'mobile') return 'mobile';
  return 'desktop';
};

const createToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

const getRevokeBefore = () => {
  const row = db.prepare("SELECT value FROM admin_config WHERE key = 'token_revoke_before'").get();
  return row ? Number(row.value) : 0;
};

const requireAdminAuth = (req, res, next) => {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const decoded = verifyToken(token);
  if (!decoded?.sub) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  // Check if token was issued before the forced-logout timestamp
  const issuedAt = (decoded.iat || 0) * 1000;
  if (issuedAt < getRevokeBefore()) {
    return res.status(401).json({ ok: false, error: 'Session expired — please sign in again' });
  }
  req.admin = decoded;
  return next();
};

const parseDateInput = (value, endOfDay = false) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d.getTime();
};

const dateBucket = (timestamp) => {
  const d = new Date(timestamp);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getOnlineNowCount = () => {
  const threshold = Date.now() - (ONLINE_WINDOW_MINUTES * 60 * 1000);
  const row = db.prepare('SELECT COUNT(DISTINCT visitor_id) AS n FROM visits WHERE timestamp >= ?').get(threshold);
  return Number(row?.n || 0);
};

const buildWhereClause = (filters = {}) => {
  const conditions = [];
  const values = [];

  if (filters.startMs) {
    conditions.push('timestamp >= ?');
    values.push(filters.startMs);
  }
  if (filters.endMs) {
    conditions.push('timestamp <= ?');
    values.push(filters.endMs);
  }
  if (filters.country) {
    conditions.push('country = ?');
    values.push(filters.country);
  }
  if (filters.city) {
    conditions.push('city = ?');
    values.push(filters.city);
  }
  if (filters.page) {
    conditions.push('page_url LIKE ?');
    values.push(`%${filters.page}%`);
  }
  if (filters.search) {
    conditions.push('(ip_address LIKE ? OR visitor_id LIKE ?)');
    values.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  return {
    whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values
  };
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ipordise-analytics', time: Date.now() });
});

app.post('/api/track', (req, res) => {
  const {
    visitorId,
    sessionId,
    pageUrl,
    referrer,
    eventType = 'pageview'
  } = req.body || {};

  const safeVisitorId = String(visitorId || '').trim();
  if (!safeVisitorId || safeVisitorId.length < 8) {
    return res.status(400).json({ ok: false, error: 'Invalid visitorId' });
  }

  const ipAddress = getIpAddress(req);
  const now = Date.now();
  const normalizedPage = normalizePath(pageUrl || req.headers.referer || '/');
  const normalizedEvent = String(eventType || 'pageview').slice(0, 32);
  const last = findLastEventStmt.get(safeVisitorId, normalizedPage, normalizedEvent);
  if (last && (now - Number(last.timestamp || 0)) < (DEDUP_WINDOW_SECONDS * 1000)) {
    upsertVisitorStmt.run({
      visitor_id: safeVisitorId,
      first_seen: now,
      last_seen: now
    });
    return res.json({ ok: true, deduped: true });
  }

  const ua = new UAParser(req.headers['user-agent'] || '');
  const geo = ipAddress ? geoip.lookup(ipAddress) : null;

  const existing = getVisitorSeenStmt.get(safeVisitorId);
  const isReturning = existing ? 1 : 0;

  const visitRecord = {
    visitor_id: safeVisitorId,
    session_id: String(sessionId || '').slice(0, 64),
    ip_address: ipAddress,
    ip_masked: maskIp(ipAddress),
    country: (geo?.country || 'Unknown').slice(0, 80),
    city: (geo?.city || 'Unknown').slice(0, 120),
    page_url: normalizedPage,
    referrer: normalizeReferrer(referrer),
    device_type: mapDeviceType(ua),
    browser: `${ua.browser?.name || 'Unknown'} ${ua.browser?.major || ''}`.trim().slice(0, 80),
    os: `${ua.os?.name || 'Unknown'} ${ua.os?.version || ''}`.trim().slice(0, 80),
    event_type: normalizedEvent,
    timestamp: now,
    user_agent: String(req.headers['user-agent'] || '').slice(0, 512),
    is_returning: isReturning
  };

  const tx = db.transaction(() => {
    insertVisitStmt.run(visitRecord);
    upsertVisitorStmt.run({
      visitor_id: safeVisitorId,
      first_seen: existing?.first_seen || now,
      last_seen: now
    });
  });

  tx();
  return res.json({ ok: true, deduped: false });
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = String(username || '').toLowerCase().trim();
  const pass = String(password || '');

  if (!ADMIN_PASSWORD_HASH || ADMIN_PASSWORD_HASH.length < 20) {
    return res.status(500).json({ ok: false, error: 'Server admin password hash is not configured' });
  }

  if (user !== ADMIN_USER) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }

  const passwordOk = await bcrypt.compare(pass, ADMIN_PASSWORD_HASH);
  if (!passwordOk) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }

  const token = createToken({ sub: user, role: 'admin' });
  res.cookie(COOKIE_NAME, token, authCookieOptions);
  return res.json({ ok: true, user });
});

app.post('/api/admin/logout', requireAdminAuth, (_req, res) => {
  res.clearCookie(COOKIE_NAME, authCookieOptions);
  return res.json({ ok: true });
});

app.post('/api/admin/force-logout-all', requireAdminAuth, (_req, res) => {
  const now = Date.now();
  db.prepare(`
    INSERT INTO admin_config (key, value) VALUES ('token_revoke_before', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(now));
  res.clearCookie(COOKIE_NAME, authCookieOptions);
  return res.json({ ok: true, revokedBefore: now });
});

app.get('/api/admin/session', requireAdminAuth, (req, res) => {
  return res.json({ ok: true, user: req.admin.sub });
});

app.get('/api/admin/overview', requireAdminAuth, (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const totalVisits = db.prepare('SELECT COUNT(*) AS n FROM visits').get().n || 0;
  const todayVisits = db.prepare('SELECT COUNT(*) AS n FROM visits WHERE timestamp >= ?').get(todayMs).n || 0;
  const uniqueVisitors = db.prepare('SELECT COUNT(DISTINCT visitor_id) AS n FROM visits').get().n || 0;
  const returningVisitors = db.prepare('SELECT COUNT(DISTINCT visitor_id) AS n FROM visits WHERE is_returning = 1').get().n || 0;
  const onlineNow = getOnlineNowCount();

  const latestVisitors = db.prepare(`
    SELECT id, visitor_id, ip_masked, country, city, device_type, browser, os, page_url, timestamp, referrer, is_returning
    FROM visits
    ORDER BY timestamp DESC
    LIMIT 12
  `).all();

  return res.json({
    ok: true,
    stats: {
      totalVisits: Number(totalVisits),
      todayVisits: Number(todayVisits),
      uniqueVisitors: Number(uniqueVisitors),
      returningVisitors: Number(returningVisitors),
      onlineNow: Number(onlineNow)
    },
    latestVisitors
  });
});

app.get('/api/admin/visitors', requireAdminAuth, (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize || 20)));
  const offset = (page - 1) * pageSize;

  const startMs = parseDateInput(req.query.startDate);
  const endMs = parseDateInput(req.query.endDate, true);
  const country = req.query.country ? String(req.query.country) : '';
  const city = req.query.city ? String(req.query.city) : '';
  const pageFilter = req.query.pageUrl ? String(req.query.pageUrl) : '';
  const search = req.query.search ? String(req.query.search) : '';

  const { whereSql, values } = buildWhereClause({
    startMs,
    endMs,
    country,
    city,
    page: pageFilter,
    search
  });

  const totalRow = db.prepare(`SELECT COUNT(*) AS n FROM visits ${whereSql}`).get(...values);
  const rows = db.prepare(`
    SELECT id, visitor_id, ip_masked, country, city, device_type, browser, os, page_url, timestamp, referrer, is_returning
    FROM visits
    ${whereSql}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `).all(...values, pageSize, offset);

  return res.json({
    ok: true,
    pagination: {
      page,
      pageSize,
      total: Number(totalRow?.n || 0),
      totalPages: Math.max(1, Math.ceil(Number(totalRow?.n || 0) / pageSize))
    },
    rows
  });
});

app.get('/api/admin/analytics', requireAdminAuth, (req, res) => {
  const rangeDays = Math.min(90, Math.max(7, Number(req.query.days || 30)));
  const sinceMs = Date.now() - (rangeDays * 24 * 60 * 60 * 1000);

  const rows = db.prepare('SELECT timestamp, country, city, page_url, device_type, browser FROM visits WHERE timestamp >= ?').all(sinceMs);

  const visitsByDayMap = new Map();
  const countryMap = new Map();
  const cityMap = new Map();
  const pageMap = new Map();
  const deviceMap = new Map();
  const browserMap = new Map();

  for (const row of rows) {
    const day = dateBucket(row.timestamp);
    visitsByDayMap.set(day, (visitsByDayMap.get(day) || 0) + 1);

    countryMap.set(row.country || 'Unknown', (countryMap.get(row.country || 'Unknown') || 0) + 1);
    cityMap.set(row.city || 'Unknown', (cityMap.get(row.city || 'Unknown') || 0) + 1);
    pageMap.set(row.page_url || '/', (pageMap.get(row.page_url || '/') || 0) + 1);
    deviceMap.set(row.device_type || 'desktop', (deviceMap.get(row.device_type || 'desktop') || 0) + 1);
    browserMap.set(row.browser || 'Unknown', (browserMap.get(row.browser || 'Unknown') || 0) + 1);
  }

  const sortedEntries = (map, limit = 10) => Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }));

  const visitsByDay = Array.from(visitsByDayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, visits]) => ({ day, visits }));

  return res.json({
    ok: true,
    rangeDays,
    visitsByDay,
    topCountries: sortedEntries(countryMap, 12),
    topCities: sortedEntries(cityMap, 12),
    topPages: sortedEntries(pageMap, 12),
    deviceBreakdown: sortedEntries(deviceMap, 6),
    browserBreakdown: sortedEntries(browserMap, 8)
  });
});

app.get('/api/admin/activity', requireAdminAuth, (_req, res) => {
  const rows = db.prepare(`
    SELECT visitor_id, ip_masked, country, city, page_url, event_type, timestamp
    FROM visits
    ORDER BY timestamp DESC
    LIMIT 25
  `).all();
  return res.json({ ok: true, rows });
});

app.get('/api/admin/export', requireAdminAuth, (req, res) => {
  const format = String(req.query.format || 'json').toLowerCase();
  const rows = db.prepare(`
    SELECT visitor_id, ip_masked, country, city, page_url, referrer, device_type, browser, os, event_type, timestamp, is_returning
    FROM visits
    ORDER BY timestamp DESC
    LIMIT 5000
  `).all();

  if (format === 'csv') {
    const columns = ['visitor_id', 'ip_masked', 'country', 'city', 'page_url', 'referrer', 'device_type', 'browser', 'os', 'event_type', 'timestamp', 'is_returning'];
    const escapeCsv = (value) => {
      const cell = String(value ?? '');
      if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
      return cell;
    };
    const body = [
      columns.join(','),
      ...rows.map((row) => columns.map((col) => escapeCsv(row[col])).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ipordise-visitors-${Date.now()}.csv"`);
    return res.send(body);
  }

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ipordise-visitors-${Date.now()}.json"`);
    return res.send(JSON.stringify(rows, null, 2));
  }

  return res.status(400).json({ ok: false, error: 'Unsupported export format' });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Route not found: ${req.method} ${req.path}` });
});

app.listen(PORT, () => {
  console.log(`IPORDISE Analytics API running on http://localhost:${PORT}`);
  console.log(`Open admin from backend host: http://localhost:${PORT}/admin.html`);
  console.log(`Alternative host: http://127.0.0.1:${PORT}/admin.html`);
  if (!ADMIN_PASSWORD_HASH || ADMIN_PASSWORD_HASH.length < 20) {
    console.warn('WARNING: ADMIN_PASSWORD_HASH is not configured in backend/.env');
  }
});
