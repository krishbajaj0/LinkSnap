# MongoDB collections

## `users`

Stores normalized `email`, display `name`, `passwordHash`, `role`, `sessionVersion`, and timestamps. Email has a unique index. Password hashes are excluded from normal Mongoose selection. Roles are `user` or `admin`. Public signup creates users. Incrementing the session version invalidates active sessions created with older versions.

## `sessions`

Stores `userId`, `sessionVersion`, hashed refresh token, `generation`, optional `rotatedAt`, `expiresAt`, `revokedAt`, and timestamps. An index on `userId`, `sessionVersion`, and `revokedAt` supports revocation. A TTL index expires documents at `expiresAt`. The session expires seven days after creation, and request handling checks the expiry independently of TTL cleanup.

## `links`

Each record belongs to a user through immutable `ownerId`. It stores `destination`, immutable `shortCode` and `codeType`, `expiresAt`, `enabled`, `tags`, `deletedAt`, and timestamps. The globally unique short-code index also prevents alias reuse after soft deletion. Expiration and soft deletion do not remove the document.

Compound indexes start with owner and deletion state, then cover created/updated/expiration sorts, short code, or exact tag filtering. A separate deletion/block/update index supports moderation. `securityBlocked`, `securityFlags`, `securityReviewedAt`, and embedded `moderationHistory` record moderation state. Owner responses expose status and a review flag while the history stays in the admin API.

`lifetimeClicks`, `lifetimeHumanClicks`, and `lifetimeBotClicks` accumulate after eligible redirect events, including events later aged out of the click collection. Owner-wide lifetime totals include soft-deleted links.

## `clickEvents`

Stores `linkId` and `ownerId`, event `timestamp`, coarse `device`, `browser`, `os`, `country`, `referrer`, `bot`, and optional derived `visitorId`. Raw IP addresses, full referrer URLs and user-agent strings are excluded. The visitor ID is excluded from normal selection and CSV. A timestamp TTL index expires events after 90 days. MongoDB TTL cleanup runs asynchronously, and analytics also bounds its query range. Owner/time and owner/link/time compound indexes support reports and exports.

## `reports`

A report links to a Link through immutable `linkId`. It stores immutable `reason` and `description`, a hidden unique deduplication `fingerprint`, `status`, optional `moderatorId` and `decision`, `notes`, embedded `moderationHistory`, and timestamps. Indexes support status/date queues, an all-status date queue, and link-based lookup.

Report and link history entries contain `moderatorId`, `action`, `note`, and `timestamp`. Link entries can also reference the associated `reportId`. Each transition updates the status and appends history atomically within its own document. A report decision and a link block remain separate operations.
