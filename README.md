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

## Production Deployment

Production is deployed by Vercel from the GitHub `prod` branch. The Vercel build
uses `vercel.json`, which runs:

```bash
npm run convex:deploy
```

That script deploys the Convex backend first, exposes the production Convex URL
as `VITE_CONVEX_URL`, and then builds the static Vite app into `docs/`.

Configure Vercel:

1. Import or connect the GitHub repo to Vercel.
2. In Vercel Project Settings -> Git, set the Production Branch to `prod`.
3. In Vercel Project Settings -> Environment Variables, add
   `CONVEX_DEPLOY_KEY` for the Production environment. Create the key from the
   Convex production deployment's deploy key settings.
4. In Vercel Domains, add `logeion.app` and `www.logeion.app`. Pick one
   canonical domain and redirect the other to it. The expected canonical URL is
   `https://logeion.app`.

Configure the Convex production environment:

```bash
npx convex env set --prod SITE_URL https://logeion.app
npx convex env set --prod AUTH_GOOGLE_ID your-google-client-id
npx convex env set --prod AUTH_GOOGLE_SECRET your-google-client-secret
npx convex env set --prod AUTH_RESEND_KEY your-resend-api-key
npx convex env set --prod AUTH_EMAIL_FROM "Knowledgebase <signin@your-verified-sending-domain>"
```

In Google Cloud Console, add the production Convex callback URL:

```text
https://industrious-gull-775.convex.site/api/auth/callback/google
```

Configure Porkbun DNS after the domains are added in Vercel:

1. Remove the Porkbun parking records that point `logeion.app` and
   `*.logeion.app` at `pixie.porkbun.com`.
2. Add the DNS records Vercel shows for the project. Usually these are:
   - `A` record, host `@`, value `76.76.21.21`
   - `CNAME` record, host `www`, value `cname.vercel-dns.com`
3. Keep the email DNS records for the sending domain unless Vercel specifically
   asks for a conflicting record.

Create and push the production branch from a ready, committed state:

```bash
git switch -c prod
git push -u origin prod
```

After the first push, merge or cherry-pick ready changes into `prod` and push
that branch. Vercel will treat each push to `prod` as a production deployment.

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
