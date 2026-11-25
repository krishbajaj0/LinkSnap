# LinkSnap redesign release checklist

Run these steps only after the redesign release is approved. The release uses the existing Render web service and database. Record the currently deployed commit from Render's **Events** or **Deploys** view before releasing so you have a known-good rollback target.

1. From the repository root, confirm the working tree is clean and review the full redesign against the latest remote branch:

   ```sh
   git switch ui-bento-redesign
   git fetch origin main
   git status --short --branch
   git diff --check origin/main...HEAD
   git log --oneline origin/main..HEAD
   git push -u origin ui-bento-redesign
   ```

2. Open a GitHub pull request from `ui-bento-redesign` into `main`. The workflow runs on pull requests targeting `main` and pushes to `main`. In the PR **Checks** tab, confirm **LinkSnap CI** passes for the exact reviewed commit. Inspect the diff for environment files, logs, generated bundles, and test account data. Stop and report conflicts or failed checks before merging.
3. Before merging, confirm the existing Render service still tracks `main` and inspect **Settings → Auto-Deploy**. If separate deploy approval is needed, verify Auto-Deploy is **Off** before updating `main`. Merge the approved PR through GitHub. Wait for CI on the resulting `main` commit and record that SHA.
4. If Auto-Deploy is off, open the existing service in Render and use **Manual Deploy → Deploy a specific commit**. Select the verified `main` SHA. Wait for the deploy to become live. If auto-deploy is enabled and separately approved, verify the deploy it started uses the same SHA. The build should resolve `VITE_PUBLIC_BASE_URL` to `https://linksnap-kp8w.onrender.com` using Render's assigned URL or a matching explicit override. Keep the existing environment and database settings.
5. Verify [Landing](https://linksnap-kp8w.onrender.com/), [liveness](https://linksnap-kp8w.onrender.com/api/v1/health), and [readiness](https://linksnap-kp8w.onrender.com/api/v1/health/ready). Refresh a nested dashboard route, check that assets load and confirm an unknown API path returns JSON 404. With disposable release-test data, verify sign-in and refresh, one short-link redirect, CSV download, and both QR exports. Decode a QR and confirm the HTTPS origin and original short-code casing. Check mobile navigation and verify a public safety preview still uses the canonical redirect.
6. Scan a downloaded QR with a physical phone. Verify the decoded HTTPS URL on the actual host and follow the disposable short link to its expected destination.
7. If a blocking regression appears, open Render's **Deploys** or **Events** view and roll back to the recorded known-good deploy if its artifact is retained. Repeat health, sign-in and redirect checks. Revert the redesign PR in GitHub using a new commit when source rollback is needed, then verify CI. Render rollback restores an app deploy and does not undo database writes.

[GitHub PR merge instructions](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request) · [Render deploy instructions](https://render.com/docs/deploys) · [Render rollback instructions](https://render.com/docs/rollbacks) · [LinkSnap deployment guide](DEPLOYMENT.md)
