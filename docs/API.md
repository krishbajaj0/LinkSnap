# LinkSnap API

[OpenAPI 3.1 contract](openapi.json) · [Database models](DATABASE.md) · [Testing guide](TESTING.md)

Import the JSON into Postman or open it in an OpenAPI-compatible viewer. The repository ships the static contract. Express does not serve an interactive documentation endpoint.

## Local requests

1. Start the API and MongoDB as described in the [root README](../README.md#run-locally). Use `http://127.0.0.1:3000` as the API base URL.
2. For auth writes such as registration, login, refresh, and logout, set `Origin: http://localhost:5173` and `X-LinkSnap-CSRF: 1`. Use any exact origin from the configured allowlist if you changed the defaults. Set `Content-Type: application/json` on requests with JSON bodies.
3. Use a disposable account. Keep Postman's cookie jar enabled for the same API host throughout testing. Register and login set the refresh cookie, and refresh replaces it. A local cookie is named `linksnap_refresh`, scoped to `/api/v1/auth`; production uses `__Host-linksnap_refresh` with `Secure`, path `/`, and no Domain attribute. Both are HttpOnly and SameSite=Lax. Browser JavaScript cannot read these cookies.
4. Use `data.accessToken` from the auth response as the Bearer token for protected API requests. Keep any copied token private. Refresh uses the cookie and trusted write headers. Logout uses the cookie if present and clears it. Logout-all and password changes use a Bearer token plus trusted write headers.
5. Admin endpoints require a current server-side admin role. Admin writes require the same trusted write headers. On link management routes, Bearer authentication and ownership checks protect the data. The client sends the custom header on writes, but the server's trusted-write middleware applies only to auth and admin routes.

## Session behavior and limits

Access JWTs expire in 15 minutes and the client stores them in memory. Every protected request also checks session validity and the current user's session version. A refresh session expires seven days after creation, even if it rotates repeatedly. When simultaneous requests reuse the immediately preceding authentic refresh token within ten seconds, the losing request receives `409 REFRESH_CONFLICT` without a new cookie. Continue with the latest cookie. Reuse outside that overlap can revoke the session.

The process-local API limit is 120 requests per IP per minute across `/api`. Registration allows eight requests, refresh 60 requests, login 12 failed attempts, and password change eight failed attempts per IP per 15 minutes. Public reports have a separate limit of five requests per IP per 15 minutes and a 4 KB JSON limit. The general JSON body limit is 32 KB. A rate-limited response can include `Retry-After`.

## Response conventions

Successful JSON uses `{"success":true,"data":...}`; errors use `{"success":false,"error":{"code":"...","message":"..."}}`. CSV and redirect successes are separate response types. Validation returns 400, missing or expired authentication 401, denied admin access or untrusted writes 403, and missing or inaccessible link resources 404. Conflicts use 409. Malformed JSON, oversized payloads, or unsupported encodings may fail before route logic.

The public short URL is `GET /{shortCode}` outside `/api/v1`. An eligible link returns `302` with `Location`, `Cache-Control: no-store`, and `Referrer-Policy: no-referrer`. Missing, inactive, blocked, or prohibited links share a generic 404. Test with redirects disabled in Postman to inspect the status and header. The preview returns only basic stored destination metadata and a path back through the same redirect checks.
