# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
# QR Studio

Open **QR Studio** from My Links or Link Details. The studio encodes the link's exact short code and uses the same classic symbol for the preview, PNG and SVG downloads. Changes and uploaded logos stay in the current browser view.

Set `VITE_PUBLIC_BASE_URL` to the public HTTPS origin that handles short redirects, such as `https://go.your-domain.com`, **before building** the frontend. Put the setting in the build environment or copy `.env.example` to an ignored `.env.local`. Rebuild when the origin changes. The setting is public frontend configuration. Verify the configured host actually serves short redirects before sharing printed codes.

The development server can use its current localhost, 127.0.0.1 or IPv6 loopback origin when the setting is blank. A QR generated this way only works on the device hosting that local server. Production requires the configured public origin and rejects local hosts, IP addresses and origins containing credentials, paths, query strings or fragments.

Defaults are black on white at 512 × 512 px, four modules of quiet zone, and medium error correction. A center logo uses high error correction. Logos are limited to PNG, JPEG or WebP up to 2 MB and 2048 × 2048 px, decoded locally and re-encoded to a small PNG before embedding. Low-contrast or undersized combinations disable exports. Test the finished code at its actual print size before distribution.

Run `npm test --prefix client` from the repository root for the QR tests.
