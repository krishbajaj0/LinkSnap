# Deploy LinkSnap on Render and MongoDB Atlas

One Render Node.js web service serves the Vite build, the Express API and canonical short redirects. MongoDB Atlas stores accounts, sessions, links, click events and reports. The client calls the API on its own origin. This guide covers the setup and acceptance checks for a new deployment.

## 1. Prepare Atlas

1. In the Atlas project you intend to use, select an approved cluster or create one on a plan you approve. Keep the application database, for example `linksnap_prod`, separate from development and testing.
2. Open **Database & Network Access** and add a dedicated application database user. Grant the built-in `readWrite` role on the application database only and restrict the user to its cluster where supported. The application uses this access to create its own indexes, including session and click TTL indexes. Use a unique random password stored in a password manager.
3. Open **Connect → Drivers**. Complete the connection string with the application database name and the database user's credentials. URL-encode reserved characters in the password. Store the connection string only as the Render service's `MONGODB_URI` secret.
4. In Render, open the service's **Connect → Outbound** tab. Add its published CIDR ranges in Atlas under **Database & Network Access → IP Access List**. These ranges can be shared by other Render services in the region. Keep strong scoped authentication enabled and avoid `0.0.0.0/0`, which allows connection attempts from anywhere. Options for tighter network access include dedicated outbound IPs or private connectivity on eligible plans with explicit approval.

[Atlas connection setup](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/) · [Atlas IP access list](https://www.mongodb.com/docs/atlas/security/ip-access-list/) · [Render outbound ranges](https://render.com/docs/outbound-ip-addresses)

## 2. Create a single Render web service

After GitHub CI passes, sign in to Render and choose **New → Blueprint**. Connect the GitHub repository `krishbajaj0/LinkSnap`, select `main`, and review the one-service [Blueprint](../render.yaml). The Blueprint selects Free for initial verification and keeps auto-deploy off. Review the instance type before applying it. Use only an approved plan. Paste the Atlas URI and an auth secret into Render's secret fields.

For manual service setup, choose **New → Web Service**, use the same repository and settings below, then add the required environment variables.

| Render setting | Value |
| --- | --- |
| Runtime | Node.js |
| Branch | `main` |
| Root Directory | Leave blank to use the repository root. The build needs both packages. |
| Node version | `>=22.13.0 <23.0.0` via `NODE_VERSION` |
| Start command | `npm start --prefix server` |
| Health check path | `/api/v1/health` |
| Auto-Deploy | Off for initial setup. Enable **After CI Checks Pass** only after verifying the deployment. |

Build command:

```sh
npm ci --prefix client --include=dev --registry=https://registry.npmjs.org --replace-registry-host=always && npm ci --prefix server --omit=dev --registry=https://registry.npmjs.org --replace-registry-host=always && npm run build --prefix client
```

The first deploy may start before the Atlas network entry is in place. Add the service's outbound ranges and use **Manual Deploy → Deploy latest commit** if startup failed. Express starts listening after MongoDB connects, the frontend is present, and model initialization succeeds. SIGTERM stops accepting connections and closes MongoDB with a bounded shutdown period.

### Environment variables

| Name | Setting |
| --- | --- |
| `NODE_ENV`, `HOST`, `PORT` | Set `production` and `0.0.0.0`. Leave `PORT` to Render. |
| `MONGODB_URI` | Required server-only Atlas connection string for the dedicated database and user. |
| `AUTH_SECRET` | Required server-only secret. Generate 32 random bytes as 64 hex characters. Keep this value stable across deploys so existing sessions remain valid. |
| `CLIENT_ORIGINS` | Defaults on Render to its system-provided HTTPS `RENDER_EXTERNAL_URL`. Set an exact HTTPS origin for a custom domain, without a trailing slash or path. Support additional named origins only when needed. |
| `VITE_PUBLIC_BASE_URL` | Public build input. Defaults on Render to the same system-provided HTTPS URL. Set it to the public redirect origin if switching to a custom domain. Rebuild after changing it. |
| `ANALYTICS_VISITOR_SECRET` | Optional server-only 32-byte hex key for visitor estimates. Generate it independently from `AUTH_SECRET`. |
| `ANALYTICS_GEOIP_PATH` | Optional path to a local MaxMind database. Leave unset without a managed copy. Country then shows as Unknown. |
| `PROHIBITED_LINK_DOMAINS` | Optional comma-separated policy domains. The list applies to exact hostnames and subdomains. |
| `TRUSTED_PROXY_IPS` | Optional comma-separated exact IPv4 or IPv6 addresses of verified inbound proxies. See proxy notes below. |
| `LINKSNAP_API_TARGET` | Vite development-only proxy override. Unused by the production server. |

For example, generate the auth secret into the clipboard without printing it. Paste it into Render's secret field and clear the clipboard. Disable or clear clipboard history if it records copied secrets.

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))" | Set-Clipboard
# Paste into the Render secret field, then clear:
Set-Clipboard -Value ''
```

Do not store credentials in a `VITE_` variable. Render makes configured variables available to build and runtime processes. The frontend build embeds only its deliberately public origin. The initial build can use the provider-assigned URL directly. For a custom domain, point the DNS to Render, confirm its TLS certificate, update both origin settings, and choose **Save, rebuild, and deploy**. [Render environment settings](https://render.com/docs/configure-environment-variables) · [Render default variables](https://render.com/docs/environment-variables)

### Proxy and health behavior

Render terminates public HTTPS at its edge. Auth sets the production `__Host-linksnap_refresh` cookie with `Secure`, `HttpOnly`, `SameSite=Lax`, path `/`, and no Domain attribute. Trust is independent of cookie issuance. Auth and admin writes must pass the exact-origin and CSRF header checks.

Render documents Cloudflare and its load balancers in the inbound path. The Blueprint leaves forwarded-header trust off because inbound peer addresses and the exact chain have not been verified for this service. Rate limiting remains active, but users can share a proxy bucket, and IP-derived analytics can reflect proxy addresses. Before enabling trust, verify the complete ingress chain and that each trusted hop sanitizes or appends forwarded headers. Set only confirmed inbound peers in `TRUSTED_PROXY_IPS`. Do not use outbound CIDRs as inbound trust. Recheck the source behavior from two independent clients before accepting per-client limits. In-memory limits reset on restart and are local to one instance. [Render ingress notes](https://render.com/articles/how-render-handles-ddos-attacks) · [Express proxy guidance](https://expressjs.com/en/guide/behind-proxies.html)

Render probes `/api/v1/health` for process liveness. Production GET/HEAD liveness requests bypass the global API limiter so a busy shared proxy bucket cannot fail the probe. Other API endpoints, including `/api/v1/health/ready`, remain limited. Readiness pings Atlas and returns 503 if disconnected. Monitor it independently and use it for deployment acceptance. This avoids restarting an otherwise healthy process during a brief Atlas outage. The MongoDB driver handles reconnection, and Mongoose does not buffer requests while disconnected. [Render health checks](https://render.com/docs/health-checks)

## 3. Verify the actual HTTPS host

Copy the assigned URL from the service page. Confirm the deployed commit and run these checks with disposable accounts and links. Save results for the deployed commit and actual hostname.

| Area | Verify |
| --- | --- |
| Shell and routes | Open Landing. Direct-load and refresh Login, Register, Dashboard, My Links, Analytics, Settings, and a link QR subroute. Check an unknown API path returns JSON 404 and a missing asset returns 404. |
| Health and Atlas | Open `/api/v1/health` and `/api/v1/health/ready`. Expect 200 and `ok` / `ready`. |
| Account lifecycle | Register and log in. Refresh to restore the session, check the production cookie attributes, then verify logout, logout-all from two independent browser profiles, and password change. |
| Links | Create a disposable link, copy the public short URL, and open it in a fresh profile. Check the destination, disable/enable behavior, dashboard counts, tags, filtering, search, and pagination. |
| Analytics and QR | Check a real redirect appears in analytics, download and inspect CSV, export PNG and SVG, and decode both to confirm the exact public short URL. Check preview and export do not themselves record a redirect. |
| Moderation | Submit a public report, confirm ordinary users receive 403 from admin APIs, and use an explicitly authorized test admin to block a disposable link. Confirm both its canonical short URL and preview return unavailable. |
| Security | Check HTTPS, Helmet/CSP, exact credentialed CORS and rejection of untrusted write origins, safe error bodies, and absence of server secrets from built assets and logs. Verify Atlas network and user scope and check rate-limit behavior from independent clients. |

Use the [manual test guide](TESTING.md) for expected outcomes and keyboard checks. A successful local test does not establish live Render routing, Atlas access, or HTTPS behavior.

## Troubleshooting and rollback

- **Build fails:** Check Node version, repository root, build logs, and the public-origin settings. A production Render build rejects a missing or invalid HTTPS public origin.
- **Startup fails:** Check Render `PORT`, the Atlas user's database scope, password escaping, region outbound ranges, and index privileges. Review sanitized app logs. Keep Atlas credentials out of support messages.
- **Login or refresh fails:** Use the assigned HTTPS host, check the exact origin and CSRF header, and inspect the cookie warning in browser dev tools. Confirm that changes to either public origin setting were deployed with a rebuild.
- **Assets or downloads fail:** Confirm Express is serving the current Vite build. Review CSP errors in browser dev tools. Images use same-origin, data and blob URLs for QR functions. Styles and fonts allow the Google Fonts hosts used by the UI.
- **Rollback:** In Render **Deploys**, select the last known-good deploy and choose **Rollback** if its artifact is retained. Check liveness, readiness, auth and short redirects again. The previous build carries its own public URL configuration. Rollback does not undo writes in Atlas. Leave auto-deploy off while fixing the issue. [Render rollback guide](https://render.com/docs/rollbacks)

Render Free is suitable for initial portfolio verification. Idle spin-down and plan resource limits affect response times. The service filesystem is ephemeral and holds only disposable build output. Keep application data in Atlas. Review an approved compute plan and backup policy before relying on the service for production traffic. [Render Free limits](https://render.com/docs/free) · [Render filesystem](https://render.com/docs/disks)
