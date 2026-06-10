# Collaborative Editor

A minimal Vite, React, and Convex app with one collaborative Tiptap editor.

## Development

```bash
npm install
npx convex dev
npm run dev
```

On this Windows machine, use `npm.cmd` if PowerShell blocks `npm.ps1`.

## Authentication

The editor uses Convex Auth with Google OAuth and Resend magic-link sign-in.
Configure these values on each Convex deployment:

```bash
npx convex env set SITE_URL https://your-app.example.com
npx convex env set AUTH_GOOGLE_ID your-google-client-id
npx convex env set AUTH_GOOGLE_SECRET your-google-client-secret
npx convex env set AUTH_RESEND_KEY your-resend-api-key
npx convex env set AUTH_EMAIL_FROM "Knowledgebase <signin@your-domain.com>"
```

For local development, set `SITE_URL` to your Vite origin, for example
`http://localhost:5173`.

In Google Cloud Console, add this Authorized redirect URI:

```text
https://your-deployment.convex.site/api/auth/callback/google
```

Use the production Convex site URL for production and the dev Convex site URL
for local development. The Resend sender domain used by `AUTH_EMAIL_FROM` must
be verified in Resend before production email links will deliver reliably.

## Static Hosting

Build the static app and embeddable editor component:

```bash
npm run build:static
```

The build writes:

- `docs/index.html` for the app
- `docs/component.html` for the statically hosted component demo
- `docs/component/collaborative-editor.js` and `.css` for embedding

Embed the component from any static host:

```html
<link rel="stylesheet" href="./component/collaborative-editor.css" />
<convex-collaborative-editor
  convex-url="https://your-deployment.convex.cloud"
  document-id="main"
></convex-collaborative-editor>
<script type="module" src="./component/collaborative-editor.js"></script>
```
