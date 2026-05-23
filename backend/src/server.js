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
import nodemailer from 'nodemailer';
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

// ── Email config ─────────────────────────────────────────────────────────────
const SMTP_HOST   = String(process.env.SMTP_HOST   || 'smtp.gmail.com');
const SMTP_PORT   = Number(process.env.SMTP_PORT   || 465);
const SMTP_SECURE = process.env.SMTP_SECURE !== 'false';
const SMTP_USER   = String(process.env.SMTP_USER   || '');
const SMTP_PASS   = String(process.env.SMTP_PASS   || '');
const ADMIN_NOTIFY_EMAIL = String(process.env.ADMIN_NOTIFY_EMAIL || SMTP_USER);
const EMAIL_FROM_NAME    = String(process.env.EMAIL_FROM_NAME    || 'IPORDISE');

const emailEnabled = Boolean(SMTP_USER && SMTP_PASS && SMTP_PASS !== 'PASTE_YOUR_GMAIL_APP_PASSWORD_HERE');

const mailer = emailEnabled
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

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

// ── Order email notifications ─────────────────────────────────────────────────
const _esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const _fmtMAD = (n) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} DH`;

const buildAdminEmail = (orderData, orderId) => {
  const c = orderData.customer || {};
  const s = orderData.summary  || {};
  const items = Array.isArray(orderData.items) ? orderData.items : [];
  const displayName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Guest';
  const orderLabel = orderId || 'N/A';
  const channelBadge = orderData.channel === 'whatsapp'
    ? `<span style="background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700">WhatsApp</span>`
    : `<span style="background:#ede9fe;color:#4f46e5;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700">Email</span>`;

  const itemsHtml = items.map((item) =>
    `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#1a1a1a;font-size:13px">${_esc(item.name)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;text-align:center">${_esc(item.size || '-')}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;text-align:center">${item.qty}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#1a1a1a;font-size:13px;text-align:right;font-weight:600">
        ${item.pricePending ? '<span style="color:#d97706">TBD</span>' : _esc(_fmtMAD(item.price * item.qty))}
      </td>
    </tr>`
  ).join('');

  const discountRow = s.discount > 0
    ? `<tr><td colspan="3" style="padding:6px 14px;color:#16a34a;font-size:13px;text-align:right">Discount (${_esc(orderData.discountCode || '')})</td>
        <td style="padding:6px 14px;color:#16a34a;font-weight:700;text-align:right;font-size:13px">-${_esc(_fmtMAD(s.discount))}</td></tr>`
    : '';

  const now = new Date();
  const dateStr = now.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;padding:32px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10)">
  <tr><td style="background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);padding:28px 36px;text-align:center">
    <div style="color:#d4af37;font-size:22px;font-weight:800;letter-spacing:0.12em">IPORDISE</div>
    <div style="color:#ccc;font-size:12px;margin-top:4px;letter-spacing:0.05em">NEW ORDER RECEIVED</div>
  </td></tr>
  <tr><td style="background:#fef3c7;border-left:4px solid #d97706;padding:12px 24px">
    <div style="color:#92400e;font-weight:700;font-size:14px">&#x1F6CD; New order from ${_esc(displayName)} &mdash; ${channelBadge}</div>
    <div style="color:#b45309;font-size:12px;margin-top:2px">Order <strong>${_esc(orderLabel)}</strong> &middot; ${dateStr}</div>
  </td></tr>
  <tr><td style="padding:24px 36px 0">
    <div style="font-size:13px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px">Customer</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:50%;padding-bottom:8px;font-size:13px;color:#1a1a1a"><strong>Name:</strong> ${_esc(displayName)}</td>
        <td style="width:50%;padding-bottom:8px;font-size:13px;color:#1a1a1a"><strong>Phone:</strong> ${_esc(c.phone || '&mdash;')}</td>
      </tr>
      <tr>
        <td style="padding-bottom:8px;font-size:13px;color:#1a1a1a"><strong>Email:</strong> ${_esc(c.email || '&mdash;')}</td>
        <td style="padding-bottom:8px;font-size:13px;color:#1a1a1a"><strong>City:</strong> ${_esc(c.city || '&mdash;')}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding-bottom:8px;font-size:13px;color:#1a1a1a"><strong>Address:</strong> ${_esc(c.address || '&mdash;')}, ${_esc(c.city || '')}, Maroc</td>
      </tr>
      ${c.notes ? `<tr><td colspan="2" style="font-size:13px;color:#555"><strong>Notes:</strong> ${_esc(c.notes)}</td></tr>` : ''}
    </table>
  </td></tr>
  <tr><td style="padding:20px 36px 0">
    <div style="font-size:13px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px">Order Items</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Product</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase">Size</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase">Qty</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase">Amount</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot style="background:#f9fafb">
        <tr><td colspan="3" style="padding:8px 14px;text-align:right;font-size:13px;color:#6b7280">Subtotal</td>
            <td style="padding:8px 14px;text-align:right;font-size:13px;color:#1a1a1a;font-weight:600">${_esc(_fmtMAD(s.subtotal))}</td></tr>
        <tr><td colspan="3" style="padding:4px 14px;text-align:right;font-size:13px;color:#6b7280">Shipping</td>
            <td style="padding:4px 14px;text-align:right;font-size:13px;color:#1a1a1a">${_esc(_fmtMAD(s.shipping))}</td></tr>
        ${discountRow}
        <tr style="border-top:2px solid #e5e7eb">
          <td colspan="3" style="padding:12px 14px;text-align:right;font-size:15px;font-weight:800;color:#1a1a1a">TOTAL</td>
          <td style="padding:12px 14px;text-align:right;font-size:15px;font-weight:800;color:#d4af37">${s.hasPendingPricing ? 'TBD' : _esc(_fmtMAD(s.total))}</td>
        </tr>
      </tfoot>
    </table>
  </td></tr>
  <tr><td style="padding:24px 36px;text-align:center">
    <a href="https://ipordise.com/admin.html" style="display:inline-block;background:#1a1a1a;color:#d4af37;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:.05em">VIEW IN ADMIN PANEL &#x2192;</a>
  </td></tr>
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 36px;text-align:center">
    <div style="font-size:11px;color:#9ca3af">IPORDISE &middot; Luxury Perfumes &middot; Morocco</div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
};

const buildClientEmail = (orderData, orderId) => {
  const c = orderData.customer || {};
  const s = orderData.summary  || {};
  const items = Array.isArray(orderData.items) ? orderData.items : [];
  const displayName = (c.firstName || 'Valued Customer').trim();
  const orderLabel = orderId || 'N/A';

  const itemsHtml = items.map((item) =>
    `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #2d2d2d;color:#e5e7eb;font-size:13px">${_esc(item.name)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #2d2d2d;color:#9ca3af;font-size:13px;text-align:center">${_esc(item.size || '-')}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #2d2d2d;color:#9ca3af;font-size:13px;text-align:center">${item.qty}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #2d2d2d;font-size:13px;text-align:right;font-weight:600;color:#d4af37">
        ${item.pricePending ? '<span style="color:#fbbf24;font-size:12px">Will be confirmed</span>' : _esc(_fmtMAD(item.price * item.qty))}
      </td>
    </tr>`
  ).join('');

  const discountRow = s.discount > 0
    ? `<tr><td colspan="3" style="padding:6px 14px;color:#4ade80;font-size:13px;text-align:right">Discount</td>
        <td style="padding:6px 14px;color:#4ade80;font-weight:700;text-align:right;font-size:13px">-${_esc(_fmtMAD(s.discount))}</td></tr>`
    : '';

  const pendingNote = s.hasPendingPricing
    ? `<tr><td style="padding:0 36px 20px">
        <div style="background:#2d2200;border:1px solid #92400e;border-radius:10px;padding:14px 18px;color:#fbbf24;font-size:13px">
          &#x23F3; <strong>Note:</strong> One or more items require price confirmation. Our team will contact you shortly.
        </div>
      </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.50)">
  <tr><td style="background:linear-gradient(135deg,#1a1a1a 0%,#0d0d0d 100%);padding:36px;text-align:center;border-bottom:1px solid #2d2d2d">
    <div style="color:#d4af37;font-size:28px;font-weight:800;letter-spacing:0.15em">IPORDISE</div>
    <div style="color:#9ca3af;font-size:12px;margin-top:6px;letter-spacing:0.08em">LUXURY PERFUMES &middot; MOROCCO</div>
  </td></tr>
  <tr><td style="padding:32px 36px;text-align:center">
    <div style="width:64px;height:64px;background:linear-gradient(135deg,#d4af37,#b8952e);border-radius:50%;display:inline-block;line-height:64px;margin-bottom:20px;font-size:28px">&#x2713;</div>
    <div style="color:#f9fafb;font-size:22px;font-weight:700;margin-bottom:8px">Order Confirmed!</div>
    <div style="color:#9ca3af;font-size:14px;line-height:1.6">Thank you ${_esc(displayName)}! We have received your order and will process it shortly.</div>
    ${orderId ? `<div style="margin-top:14px;display:inline-block;background:#1f1f1f;border:1px solid #d4af37;border-radius:8px;padding:8px 20px;color:#d4af37;font-size:13px;font-weight:700;letter-spacing:.05em">Order #${_esc(orderLabel)}</div>` : ''}
  </td></tr>
  ${pendingNote}
  <tr><td style="padding:0 36px 24px">
    <div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.07em;margin-bottom:12px">Your Order</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #2d2d2d;border-radius:10px;overflow:hidden">
      <thead>
        <tr style="background:#1a1a1a">
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Product</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase">Size</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase">Qty</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase">Price</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot style="background:#1a1a1a">
        <tr><td colspan="3" style="padding:8px 14px;text-align:right;font-size:12px;color:#6b7280">Subtotal</td>
            <td style="padding:8px 14px;text-align:right;font-size:13px;color:#d1d5db">${_esc(_fmtMAD(s.subtotal))}</td></tr>
        <tr><td colspan="3" style="padding:4px 14px;text-align:right;font-size:12px;color:#6b7280">Shipping</td>
            <td style="padding:4px 14px;text-align:right;font-size:13px;color:#d1d5db">${_esc(_fmtMAD(s.shipping))}</td></tr>
        ${discountRow}
        <tr style="border-top:1px solid #2d2d2d">
          <td colspan="3" style="padding:12px 14px;text-align:right;font-size:15px;font-weight:800;color:#f9fafb">Total</td>
          <td style="padding:12px 14px;text-align:right;font-size:15px;font-weight:800;color:#d4af37">${s.hasPendingPricing ? 'TBD' : _esc(_fmtMAD(s.total))}</td>
        </tr>
      </tfoot>
    </table>
  </td></tr>
  <tr><td style="padding:0 36px 24px">
    <div style="background:#1a1a1a;border:1px solid #2d2d2d;border-radius:10px;padding:16px 20px">
      <div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px">Delivery Details</div>
      <div style="color:#d1d5db;font-size:13px;line-height:1.8">
        <div>&#x1F4E6; <strong style="color:#f9fafb">${_esc(displayName)}</strong></div>
        <div>&#x1F4CD; ${_esc(c.address || '')}, ${_esc(c.city || '')}, Maroc</div>
        <div>&#x1F4DE; ${_esc(c.phone || '')}</div>
        <div style="margin-top:8px;color:#9ca3af;font-size:12px">&#x1F4B3; Payment: <strong style="color:#d4af37">Cash on Delivery (COD)</strong></div>
        <div style="color:#9ca3af;font-size:12px">&#x1F69A; Delivery: <strong style="color:#f9fafb">35 MAD &mdash; 2&ndash;5 business days across Morocco</strong></div>
      </div>
    </div>
  </td></tr>
  <tr><td style="padding:0 36px 32px;text-align:center">
    <div style="color:#6b7280;font-size:12px;margin-bottom:16px">Questions about your order?</div>
    <a href="mailto:perfumiro@gmail.com" style="display:inline-block;background:linear-gradient(135deg,#d4af37,#b8952e);color:#1a1a1a;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:.05em;margin-right:8px">EMAIL US</a>
    <a href="https://wa.me/212600000000" style="display:inline-block;background:#25D366;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:.05em">WHATSAPP</a>
  </td></tr>
  <tr><td style="background:#0d0d0d;border-top:1px solid #1f1f1f;padding:20px 36px;text-align:center">
    <div style="color:#d4af37;font-size:14px;font-weight:700;letter-spacing:.1em;margin-bottom:4px">IPORDISE</div>
    <div style="font-size:11px;color:#4b5563">Luxury Perfumes &middot; Morocco &middot; ipordise.com</div>
    <div style="font-size:10px;color:#374151;margin-top:8px">You received this email because you placed an order on ipordise.com</div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
};

// POST /api/orders/notify — send admin + client confirmation emails
app.post('/api/orders/notify', async (req, res) => {
  const { orderData, orderId } = req.body || {};

  if (!orderData || typeof orderData !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid order data' });
  }

  const customer = orderData.customer || {};
  const items    = Array.isArray(orderData.items) ? orderData.items : [];

  if (!customer.phone && !customer.email) {
    return res.status(400).json({ ok: false, error: 'Order must have customer phone or email' });
  }
  if (items.length === 0) {
    return res.status(400).json({ ok: false, error: 'Order has no items' });
  }

  if (!emailEnabled) {
    console.warn('[IPORDISE] Email not configured — skipping notification for order', orderId || '?');
    return res.json({ ok: true, sent: false, reason: 'email_not_configured' });
  }

  const displayName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Guest';
  const errors = [];

  // Admin notification email
  try {
    await mailer.sendMail({
      from: `"${EMAIL_FROM_NAME}" <${SMTP_USER}>`,
      to: ADMIN_NOTIFY_EMAIL,
      subject: `New Order${orderId ? ` #${orderId}` : ''} — ${displayName}`,
      html: buildAdminEmail(orderData, orderId),
    });
  } catch (err) {
    console.error('[IPORDISE] Admin email failed:', err.message);
    errors.push('admin_email_failed');
  }

  // Client confirmation email
  const clientEmail = String(customer.email || '').trim();
  if (clientEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    try {
      await mailer.sendMail({
        from: `"${EMAIL_FROM_NAME}" <${SMTP_USER}>`,
        to: clientEmail,
        replyTo: ADMIN_NOTIFY_EMAIL,
        subject: `Order Confirmed${orderId ? ` #${orderId}` : ''} — IPORDISE`,
        html: buildClientEmail(orderData, orderId),
      });
    } catch (err) {
      console.error('[IPORDISE] Client email failed:', err.message);
      errors.push('client_email_failed');
    }
  }

  return res.json({ ok: true, sent: true, errors: errors.length ? errors : undefined });
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
