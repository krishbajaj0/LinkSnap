# LinkSnap testing guide

## Automated checks

Install both packages with `npm ci` using the [local setup guide](../README.md#run-locally). Start a disposable local MongoDB server on loopback port 27017, or set `LINKSNAP_TEST_MONGO_PORT` to its assigned port. The integration tests construct their own randomly named databases on `127.0.0.1` and drop only those databases. Use a dedicated test instance instead of a personal, shared, or production server. The tests create ephemeral signing keys and do not read your app's MongoDB URI or JWT secret.

```sh
npm test --prefix server
npm test --prefix client
npm run lint --prefix client
npm run build --prefix client
git diff --check
npm audit --prefix client --omit=dev --registry=https://registry.npmjs.org
npm audit --prefix client --registry=https://registry.npmjs.org
npm audit --prefix server --omit=dev --registry=https://registry.npmjs.org
npm audit --prefix server --registry=https://registry.npmjs.org
```

The auth, link, analytics and moderation integration suites require MongoDB. Standalone validation and HTTP foundation tests include tests that need no live database. The frontend Node suite tests password rules, HTTP request handling, session-operation coordination and QR services. Browser navigation, downloads and focus still require manual verification.

To validate the static API document without adding a repository dependency, run `npx --yes @redocly/cli@2.78.0 lint --extends spec docs/openapi.json` from the root with npm 10 or newer. Use the [OpenAPI contract](openapi.json) and [API guide](API.md) to review response changes with their route handlers.

GitHub Actions runs lint, tests, build, OpenAPI validation, and high-or-critical production dependency checks on pushes and pull requests targeting `main`. Its Node.js 22 runner starts an isolated MongoDB 8 service and needs no repository secrets. Full advisory review uses the four commands above.

## Manual end-to-end checklist

Start both services with a separate development database such as `linksnap_e2e_local`. Use disposable accounts and public example URLs. Keep a second independent browser profile for session and permission checks.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Register with a unique `example.test` email. Try a short password first. | Validation rejects the short password. Valid registration opens the dashboard as a regular user. |
| 2 | Log out, try an incorrect password, then log in with the correct one. | Incorrect credentials show an error. Valid credentials open the dashboard. |
| 3 | Create a link to `https://example.com/` and leave the alias blank. | An automatic short code appears in My Links. |
| 4 | Create another link with a unique lowercase custom alias. Repeat the same alias. | The first request succeeds. The duplicate is rejected. |
| 5 | Open the short URL in the browser. | The browser redirects to the saved destination. |
| 6 | Open Analytics, refresh after the background write, expand the trend table, and export CSV. | The click appears in the selected UTC range. CSV contains matching coarse metadata and excludes raw IPs and visitor IDs. |
| 7 | Search for a code, combine a status or tag filter with sorting, and move to page 2 if there are enough rows. | Matching results, sort order and page boundaries are correct. An unmatched query shows the filtered empty state. |
| 8 | Edit the destination in Link Details and reopen the short URL. | The code stays the same and the redirect reaches the new URL. |
| 9 | Set an expiration shortly in the future, retry after it elapses, then clear it. | The expired link is unavailable. Clearing expiration restores redirect eligibility. |
| 10 | Disable and enable a link. | Disabled links are unavailable; enabled links redirect when otherwise eligible. |
| 11 | Select disposable links and bulk add a tag, disable them, and open then cancel bulk deletion. | Eligible rows change and counts are reported. Cancel preserves the links. |
| 12 | Open QR Studio, change colors and size, try low contrast, then export PNG and SVG with valid settings. | Low contrast disables export. Valid files both encode the exact canonical URL. Preview and export alone add no click. |
| 13 | Open Destination Preview and submit a report. First try an invalid code, then use the actual alias. | Invalid input shows an error. A valid submission receives the generic acknowledgment. |
| 14 | Open Moderation as a normal user, then sign in separately with an authorized disposable admin. Review the report and block the link. | Normal users are denied. Admin decisions create history entries. Use the [admin bootstrap guide](../server/README.md#bootstrap-the-first-admin) only in the disposable environment. |
| 15 | Open the blocked short URL, its preview, and the same URL from the exported QR. Then unblock it as admin. | Blocked requests return unavailable without a successful click. The active link redirects again after unblock. |
| 16 | Try a wrong current password, then change the disposable account's password successfully. | The wrong password fails. Successful change revokes sessions and only the new password works. |
| 17 | Sign in with two isolated browser profiles and log out in the first. | Its current session ends. The other profile still works. |
| 18 | Sign in again in the first browser, then confirm logout-all in Settings. Reload both dashboards. | Both profiles require login. Escape from the confirmation leaves sessions active. |
| 19 | Log in, reload a direct dashboard route and inspect Network for refresh. Using Postman with the same cookie jar, refresh twice in sequence. | Reload restores the session. Refresh rotates the cookie and returns a new access token without extending the session's original expiration. |
| 20 | Open and refresh a dashboard URL in a signed-out profile. Log in when prompted. | The route is protected and sign-in returns you to a recognized dashboard path. |

For CSV or QR inspection, check the downloaded file rather than relying only on the in-app download message. For a loopback QR, decode it locally or open it on the machine serving that origin.

## Responsive and keyboard checks

Check Landing, Login, My Links, Analytics, QR Studio, Settings and Moderation at 375, 400, 768 and 1280 CSS pixels. Confirm visible navigation, wrapping of long destinations, and absence of body-level horizontal scrolling. Refresh a nested route while signed in and signed out.

Use Tab and Shift+Tab to verify focus order and indicators. Use the skip link, open the mobile navigation with Enter, navigate to a link, and close the open menu with Escape. Confirm focus returns to its trigger. Open a confirmation dialog, verify focus starts on Cancel, then close it with Escape and check focus restoration. Check error and success announcements with a screen reader where available.
