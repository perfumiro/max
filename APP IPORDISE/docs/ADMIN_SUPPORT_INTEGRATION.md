# Admin dashboard and customer-care integration

The mobile app now submits customer conversations through the `support-inbox` Edge Function. Direct anonymous reads of support tables are not permitted.

## Deploy

```sh
supabase db push
supabase functions deploy support-inbox --no-verify-jwt
supabase functions deploy create-order --no-verify-jwt
supabase functions deploy track-order --no-verify-jwt
supabase functions deploy admin-catalog-sync --no-verify-jwt
```

Set `EXPO_PUBLIC_ADMIN_DASHBOARD_URL` in the Expo environment to the authenticated dashboard URL. This value is only a navigation destination; the dashboard must still require staff authentication.

## Responsive dashboard

The Expo web build includes the protected administration surface at `/app`. The legacy `/?admin=1` preview route remains available for compatibility. It adapts to phone, tablet, and desktop widths and provides:

- an operational overview with catalogue, order, revenue, and support indicators;
- product price, stock, and app-visibility controls;
- order status workflows from pending through delivered or cancelled;
- support priority and resolution controls;
- role verification, persisted staff sessions, and mutation audit events.

The dashboard signs in through Supabase Auth and then verifies an active `admin_users` row with the `admin` role. Every data request uses the staff access token, so existing RLS policies remain the authority. The browser never receives a service-role or secret key.

For local development, open `http://localhost:8081/app`. For production, deploy the Expo web build on `ipordise.com`, rewrite `/app` and `/app/*` to the exported `index.html`, and set `EXPO_PUBLIC_ADMIN_DASHBOARD_URL=https://ipordise.com/app`.

## Dashboard inbox API

Send `POST /functions/v1/support-inbox` with the Supabase publishable key in `apikey` and the signed-in Firebase ID token as `Authorization: Bearer <token>`.

Supported staff actions:

- `{ "action": "admin_list", "status": "open" }`
- `{ "action": "admin_thread", "conversationId": "..." }`
- `{ "action": "admin_reply", "conversationId": "...", "message": "..." }`
- `{ "action": "admin_update", "conversationId": "...", "status": "resolved", "priority": "normal" }`

Only active `admin_users` rows with role `admin` or `support` are accepted. Replies are recorded in `support_messages`, update the conversation status, and create an audit event. The customer app polls the protected conversation endpoint and displays staff replies in the same private thread.

The dashboard can alternatively use Supabase authenticated sessions and query the two support tables directly. Their RLS policies grant access only to active `admin` and `support` roles.

## Orders and changeable prices

The app submits checkout requests to `POST /functions/v1/create-order`. The client sends product IDs, selected sizes, quantities, and delivery details only. The function reloads every product from the Supabase catalog, uses the current dashboard-managed price, validates stock and availability, adds the configured delivery fee, and writes the confirmed order into `public.orders`.

The admin dashboard should list `public.orders` for active staff and allow status changes such as `pending`, `confirmed`, `shipped`, `delivered`, and `cancelled`. The existing RLS policy restricts these updates to authenticated IPORDISE administrators.

Catalog prices remain editable through the dashboard catalog sync. Changes to product size prices are reflected in the app catalog refresh and are always rechecked by `create-order` before an order is accepted, so an old or modified client cannot choose its own price.
