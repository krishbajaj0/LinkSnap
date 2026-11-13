# LinkSnap API

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

The API limits requests under `/api` to 120 per IP per minute, including health requests. A rejected request gets a JSON `429` and a `Retry-After` header. The counters are in memory and local to each server process. Before deploying behind a reverse proxy, configure Express to trust only the deployment's actual proxy hops so the limit uses the client IP.

Vite forwards `/api` to `http://127.0.0.1:3000` during development. Set `LINKSNAP_API_TARGET` in your shell or the ignored client `.env` if the backend uses another address. The client uses relative API URLs, so a future same-origin deployment can serve React and the API together.

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

Foundation tests use an injected readiness check. Authentication tests use a randomly named database on local MongoDB at `127.0.0.1:27017` and clean up only that database. Set `LINKSNAP_TEST_MONGO_PORT` to use a different local port. Use `npm start --prefix server` to run without file watching.
