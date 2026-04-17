# IPORDISE Site + Professional Admin Analytics

This project includes a backend-powered visitor tracking system and a private admin dashboard for traffic intelligence.

## What's Included

- Public tracking endpoint: `/api/track`
- Secure admin authentication with an HTTP-only session cookie and JWT
- SQLite analytics storage under `backend/data/analytics.db`
- Overview cards for total visits, today's visits, unique visitors, returning visitors, and users online
- Visitor table with search, date filters, country/city/page filters, and pagination
- Visits-over-time chart, device chart, browser breakdown, top countries, top cities, and most visited pages
- Live activity feed and near real-time online visitor count
- CSV and JSON export with masked IP addresses
- Responsive light/dark admin UI with mobile visitor cards

## Structure

- `admin.html` - private admin dashboard shell
- `assets/admin/admin.css` - dashboard styling
- `assets/admin/admin.js` - admin app logic and API calls
- `backend/src/server.js` - analytics API server
- `backend/scripts/hash-password.js` - helper for generating admin password hashes
- `backend/.env.example` - backend configuration template

## Run Backend Locally

1. Install dependencies:

```bash
cd backend
npm install
```

2. Create your environment file:

```bash
copy .env.example .env
```

3. Generate a secure password hash:

```bash
npm run hash-password -- "your-strong-password"
```

4. Put the generated hash into `backend/.env` as `ADMIN_PASSWORD_HASH`, set `ADMIN_USER`, and replace `JWT_SECRET` with a long random value.

5. Start the analytics server:

```bash
npm run dev
```

The API runs by default at `http://localhost:5050`.

## Open Admin Dashboard

Open:

```text
http://localhost:5050/admin.html
```

Log in with the `ADMIN_USER` and password you configured in `backend/.env`.

## Tracking Setup

The storefront tracker is initialized in `script.js`. It sends:

- Visitor ID from localStorage
- Session ID from sessionStorage
- Page URL
- Referrer
- Timestamp
- Device, browser, OS, city, country, and IP from the server request

By default it posts to same-origin `/api/track`. If your public website is hosted separately from the backend, add this to each public page head:

```html
<meta name="ipordise-analytics-base" content="https://your-analytics-domain.com">
```

Or set:

```js
window.IPORDISE_ANALYTICS_BASE = 'https://your-analytics-domain.com';
```

Also add your website origin to `CORS_ORIGIN` in `backend/.env`.

## Accuracy Notes

Visitor tracking is designed to be as accurate as practical, but no website analytics system is 100% exact. Browser privacy settings, ad blockers, network failures, VPNs, shared IPs, and deleted storage can affect counts.

## Privacy And Security Notes

- The backend stores raw IP addresses for internal analytics, but the admin UI and export endpoints show masked IP addresses.
- Admin endpoints require authentication.
- `backend/.env`, `backend/data/`, and `backend/node_modules/` are ignored by git.
- Use HTTPS in production so secure cookies and visitor tracking are protected in transit.
