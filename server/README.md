# LinkSnap API

See the [OpenAPI contract](../docs/openapi.json), [Postman and authentication guide](../docs/API.md), and [test guide](../docs/TESTING.md) for endpoint details and verification.

Run these commands from the repository root with Node.js 22.13 or newer.

```powershell
npm ci --prefix server
Copy-Item server/.env.example server/.env
npm run dev --prefix server
```

For the existing local MongoDB service, set `MONGODB_URI=mongodb://127.0.0.1:27017/linksnap` in `server/.env` before starting the API. Use your own local connection string if your installation uses a different port or requires authentication. The root `.gitignore` excludes the local file.

## MongoDB Atlas

1. Create a database user with access scoped to the LinkSnap database.
2. Add the API host's outbound IP to the Atlas project's IP access list, or configure private network access.
3. In Atlas, open **Connect → Drivers** and copy the generated connection string. Set the database name and URL-encode any reserved characters in the credentials.
4. Put the completed URI in your ignored local `server/.env` or in your deployment's secret environment variables. Start the API and call `/api/v1/health/ready` to verify connectivity.

See the [Atlas connection guide](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).

## Server configuration

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Defaults to `development`. Set to `production` for production. |
| `HOST` | Defaults to `127.0.0.1` locally and `0.0.0.0` in production. |
| `PORT` | Defaults to `3000`. |
| `CLIENT_ORIGINS` | Comma-separated browser origins, without paths or trailing slashes. Defaults to the two local Vite origins in development and an empty allowlist in production. |
| `MONGODB_URI` | Required in production. Local development can start without it for HTTP checks. |
| `AUTH_SECRET` | 32 random bytes encoded as 64 hex characters. Required in production and to enable local authentication. |

When a MongoDB URI is configured, startup requires an initial connection. An invalid or unavailable connection stops startup with a sanitized error.

The API limits requests under `/api` to 120 per IP per minute. Production GET and HEAD liveness probes are exempt. Readiness remains limited. A rejected request gets a JSON `429` and a `Retry-After` header. The counters are in memory and local to each server process. Before deploying behind a reverse proxy, configure Express to trust only verified inbound proxy peers. See the [deployment guide](../docs/DEPLOYMENT.md#proxy-and-health-behavior).

Vite forwards `/api` to `http://127.0.0.1:3000` during development. Set `LINKSNAP_API_TARGET` in your shell or the ignored client `.env` if the backend uses another address. The client uses relative API URLs, so a future same-origin deployment can serve React and the API together.

## Short links

Send a bearer access token to `/api/v1/links`. `POST` accepts a `destination`, optional `alias`, and optional future UTC ISO `expiresAt`. `GET` lists the current user's links with `page` (1–1000) and `limit` (1–50). `GET /:id` reads a link, `PATCH /:id` updates `destination`, `expiresAt` or `enabled`, and `DELETE /:id` soft-deletes it. Set `expiresAt` to null to remove expiration. The status is calculated from moderation, enabled state, and expiration. Aliases are immutable and remain reserved after deletion.

Public `GET /:shortCode` returns `302` with `Cache-Control: no-store` for active links. Unknown and unavailable codes share a generic `404`. Vite forwards canonical short-code paths to Express while keeping reserved application routes in React. In a future same-service deployment, serve API routes and the short-code router before the SPA fallback. Serve static assets and known SPA paths without sending them through the redirect lookup. Reserve new top-level application paths before exposing them.

Link creation and redirects parse destination URLs locally and make no outbound destination requests.

### Click analytics

Authenticated endpoints under `/api/v1/analytics` are `GET /`, `GET /links/:id`, `GET /export.csv`, and `GET /links/:id/export.csv`. Dates `from` and `to` are inclusive UTC calendar days. Daily reports default to the last 30 days and cover at most the latest 90 UTC days. Hourly reports default to today and allow up to seven days. Set `traffic=all`, `human`, or `bot`. The selected-range report reads retained events. Lifetime counters include all traffic and dates, including deleted links in the overall total. Breakdowns return the top 12 categories, and the most-clicked table returns up to 10 links.

Exports contain up to 5,000 matching events, newest first. The response sets `X-Analytics-Export-Truncated` when the limit is reached. CSV fields are quoted and spreadsheet formula prefixes are neutralized. No raw request headers, IPs, or visitor IDs appear in responses or exports.

An eligible GET redirect responds before recording starts. HEAD and explicit prefetch requests are skipped. The recorder allows up to 64 concurrent jobs, with 1.5-second MongoDB operation budgets. It inserts an event, then increments the three lifetime counters as applicable using an atomic `$inc` that does not change the link's edit timestamp. If insertion fails, the counter is skipped. If the counter write fails after insertion, the event remains reportable and the lifetime count can lag. A replay with the same event ID is ignored. Separate client requests are separate click attempts. Saturation, process exit, and database failure can lose writes without affecting the redirect. Event TTL is 90 days and MongoDB removes expired documents asynchronously. Link counters have no TTL.

- `ANALYTICS_VISITOR_SECRET` is an optional, separate 32-byte random hex key. Generate it in the same way as the auth secret and keep it in the ignored environment file. Without it, visitor estimates are disabled and click counts continue. The HMAC uses owner, IP, and coarse device/browser/OS categories under a key derived for the UTC day. Across days the same visitor may count again. Shared IPs and changing devices or networks affect estimates.
- `ANALYTICS_GEOIP_PATH` optionally points to a locally provisioned MaxMind-compatible Country or City `.mmdb`. Lookups stay in-process. Missing files, missing country records and local/private IPs generally yield Unknown. Keep the database current and provision it separately from the repository.
- `TRUSTED_PROXY_IPS` is optional and accepts exact IPs of controlled proxies. With it unset, Express uses the socket peer and ignores forwarded IP headers. Only configure proxies that replace or safely append forwarding information. Verify the ingress addresses and client-IP behavior before enabling this on Render. Local Vite proxy traffic may share one socket IP.
- Referrers are reduced to registrable domains. Requests without a referrer are Direct. User-agent matching flags common crawlers, preview clients, headless clients and command-line tools. Spoofed or unfamiliar user agents can be misclassified, so non-bot counts are estimates.

### Dashboard and link management

- `GET /api/v1/links/overview` returns owner-scoped counts and the five newest and five most recently updated links. Recent counts cover the last seven days. Soft-deleted rows are excluded. Status precedence is deleted, security-blocked, disabled, expired, then active, matching public redirects.
- List queries accept `search` (literal case-insensitive substring of code, destination, or tag, up to 100 characters), `status` (`active`, `disabled`, `expired`, `security-blocked`), exact `tag`, inclusive UTC dates `createdFrom` and `createdTo` in `YYYY-MM-DD`, and `sort` (`newest`, `oldest`, `updated`, `expiration`, `code`). Expiration sorting puts latest deadlines first and unset deadlines last. Counts and paging apply to the filtered results.
- Create and edit accept `tags` as an array of up to 10 strings. Tags are trimmed, lowercased, deduplicated, and limited to 32 characters each. `PATCH` replaces the supplied tag list.
- `POST /api/v1/links/bulk` takes `{ action, ids, tag? }` with 1–50 IDs and one of `enable`, `disable`, `delete`, `add-tag`, or `remove-tag`. It returns `requested`, `changed`, and `skipped` for the deduplicated IDs. Each write is conditional and atomic per link. Missing, foreign, deleted, already-matching, and otherwise ineligible rows contribute to the same skipped count. Bulk enable skips security-blocked links, and adding a tag to a full list is skipped. A batch is not an all-or-nothing transaction.
- Compound indexes start with owner and deletion state, then cover the list's date/code sorts and exact tag filtering. Substring search still scans candidate rows for that owner because a case-insensitive substring expression cannot use an index for the match itself. Consider a dedicated search index for large collections.

## Authentication

Generate the local secret directly into your existing, ignored `server/.env`. Replace an existing blank `AUTH_SECRET=` line rather than adding a duplicate. This PowerShell example requires the template line and preserves the rest of the file.

```powershell
$envPath = 'server/.env'
$content = Get-Content -Raw -LiteralPath $envPath
if ($content -notmatch '(?m)^AUTH_SECRET=\r?$') { throw 'Expected a blank AUTH_SECRET line in server/.env' }
$secret = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
Set-Content -LiteralPath $envPath -Value ($content -replace '(?m)^AUTH_SECRET=(?=\r?$)', "AUTH_SECRET=$secret") -NoNewline
Remove-Variable secret
```

| Method and route under `/api/v1/auth` | Purpose |
| --- | --- |
| `POST /register` | Create a regular user and start a session. |
| `POST /login` | Verify credentials and start a session. |
| `POST /refresh` | Rotate the cookie and issue a fresh access token. |
| `POST /logout` | Revoke the current cookie's session. |
| `POST /logout-all` | Revoke all sessions for the authenticated user. |
| `GET /me` | Return the authenticated user's public profile. |
| `PATCH /me` | Update the current user's name (trimmed, 1–80 characters). Requires an access token and trusted write headers. |
| `PATCH /change-password` | Verify the current password, update it, and revoke all sessions. |

- Access JWTs last 15 minutes and live in React memory. Protected APIs check both the session record and the user's session version. Refresh tokens are random, authenticated, and stored as hashes. The session expires seven days after creation, regardless of rotations.
- One atomic update can rotate a token. The immediately previous authentic token gets `409` for ten seconds without receiving credentials or clearing the cookie. Reuse outside that overlap revokes the session. The browser serializes session operations across tabs where Web Locks is available.
- Auth writes require an exact allowlisted `Origin` and the custom `X-LinkSnap-CSRF: 1` header. Cross-origin browser scripts need a successful CORS preflight to send the header. The API only permits credentials for explicit origins.
- Local cookies use HttpOnly, SameSite=Lax, and the auth API path. Production uses a Secure, HttpOnly, SameSite=Lax `__Host-` cookie, which requires HTTPS, root path, and no Domain attribute. Set `CLIENT_ORIGINS` to the exact public HTTPS origin for same-service deployment. A separate cross-site deployment needs its own cookie and CORS design.
- Registration, login, refresh, and password changes have per-IP rate limits in addition to the API limit. Sign-up uses a unique normalized email index and a generic conflict message. Public signup always creates a regular user.

## Health checks

- `GET /api/v1/health` returns HTTP 200 when the Express process responds.
- `GET /api/v1/health/ready` returns HTTP 200 when MongoDB responds to a ping. It returns HTTP 503 when MongoDB is unconfigured or unavailable.

```powershell
curl.exe -i http://127.0.0.1:3000/api/v1/health
curl.exe -i http://127.0.0.1:3000/api/v1/health/ready
npm test --prefix server
```

Foundation tests use an injected readiness check. Authentication, link, analytics, and moderation integration tests use randomly named databases on a disposable MongoDB instance at `127.0.0.1:27017` and clean up only those databases. Set `LINKSNAP_TEST_MONGO_PORT` to use a different local port. Use `npm start --prefix server` to run without file watching.

## Safety and abuse moderation

- `GET /api/v1/preview/:code` returns the hostname, protocol, caution flag and a relative short-link path for an eligible link. Continue goes through the canonical redirect handler, which checks current state again. Preview neither contacts the destination nor records a click.
- `POST /api/v1/reports` accepts JSON with `shortCode`, `reason` (`phishing`, `malware`, `spam`, `impersonation`, `other`), and optional `description` (500 characters). The body limit is 4 KB and the process-local limit is five submissions per IP in 15 minutes. A honeypot and a unique daily link/reason/reporter digest suppress duplicates. The digest uses the server's existing auth secret with a distinct purpose prefix. Without that secret, deduplication is shared per link/reason/day. No raw reporter IP is persisted. Normal, duplicate, honeypot and unknown-code submissions return the same acknowledgment.
- `GET /api/v1/admin/reports` and `GET /api/v1/admin/links` list the queues. Their `/:id` endpoints expose details and accept `PATCH` decisions. Every admin endpoint checks the current user role on the server. Writes also require the configured origin and CSRF header. State changes and their append-only audit entries are atomic within the affected report or link. A report's status is a separate decision from a link block, so a moderator can mark the related report actioned after applying the block.
- `PROHIBITED_LINK_DOMAINS` is an optional comma-separated operator-maintained list. Entries apply to the exact hostname and its subdomains, including existing links at redirect time. IP literals, internationalized labels, many subdomains, misleading subdomain words and recognizable forwarding URLs are review signals. These heuristics can flag legitimate sites or miss harmful ones. The server makes no destination requests, verifies no remote reputation, and cannot see what a destination serves or where it forwards. The existing bot classifier remains an analytics estimate and does not block navigation.
- A moderator block survives owner edits and bulk actions. Redirects read the current link record from the primary, enforce lifecycle and URL policy, and only then schedule analytics. A request that already passed the checks may finish while a moderator is applying a block.

### Bootstrap the first admin

Register a normal account for the intended operator and independently verify its identity. Use an authenticated database administration session against the correct environment. Locate the exact account by its normalized email, verify the result, and use its unique ID in the following `mongosh` command. Keep database credentials in the normal secure connection workflow.

```javascript
db.users.updateOne({ _id: ObjectId("<verified-user-id>"), role: "user" }, { $set: { role: "admin" } })
```

Require exactly one matched and modified record. Have that operator sign out and back in to refresh the dashboard navigation. Record the grant in the environment's administrative access log. Public signup cannot grant the admin role.
