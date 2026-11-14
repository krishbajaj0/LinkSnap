# LinkSnap frontend

See the [project README](../README.md#run-locally) for setup and the [test guide](../docs/TESTING.md) for verification. React Router defines the public and protected screens in [App.jsx](src/App.jsx). Vite proxies API and canonical short-link requests to Express during local development.

## QR Studio

Open **QR Studio** from My Links or Link Details. PNG and SVG downloads encode the same short URL as the preview. Changes and uploaded logos stay in the current browser view.

Set `VITE_PUBLIC_BASE_URL` to the public HTTPS origin that serves short redirects before building the frontend. Rebuild when the origin changes. This setting is public configuration. In development, the studio can use the current loopback origin, so a QR code generated locally normally works only on the device running the server. Production rejects loopback origins, IP literals, and origins with credentials, paths, query strings, or fragments.

Defaults are black on white at 512 × 512 pixels, with four modules of quiet zone and medium error correction. A center logo uses high error correction. Logos must be PNG, JPEG, or WebP, up to 2 MB and 2048 × 2048 pixels. They are decoded and re-encoded locally. Insufficient contrast or size disables export. Scan the finished code at its intended print size before distributing it.
