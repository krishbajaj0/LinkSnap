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

When a MongoDB URI is configured, startup requires an initial connection. An invalid or unavailable connection stops startup with a sanitized error.

The API limits requests under `/api` to 120 per IP per minute, including health requests. A rejected request gets a JSON `429` and a `Retry-After` header. The counters are in memory and local to each server process. Before deploying behind a reverse proxy, configure Express to trust only the deployment's actual proxy hops so the limit uses the client IP.

The Vite dev server has no API proxy configured. For local API calls, use the Express URL directly and run the frontend from an allowed origin.

## Health checks

- `GET /api/v1/health` returns HTTP 200 when the Express process responds.
- `GET /api/v1/health/ready` returns HTTP 200 when MongoDB responds to a ping. It returns HTTP 503 when MongoDB is unconfigured or unavailable.

```powershell
curl.exe -i http://127.0.0.1:3000/api/v1/health
curl.exe -i http://127.0.0.1:3000/api/v1/health/ready
npm test --prefix server
```

The automated tests use an injected readiness check and do not require database credentials. Use `npm start --prefix server` to run without file watching.
