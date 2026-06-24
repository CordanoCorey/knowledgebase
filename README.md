# Logeion

Logeion is Arche Press's knowledgebase app: a place for words, built with
Vite, React, Convex, and a collaborative Tiptap editor.

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
npx convex env set AUTH_EMAIL_FROM "Logeion <signin@your-domain.com>"
npx convex env set OPENAI_API_KEY your-openai-api-key
npx convex env set OPENAI_SMART_STORAGE_MODEL gpt-5.4-nano
```

For local development, set `SITE_URL` to your Vite origin, for example
`http://localhost:5173`.

`OPENAI_SMART_STORAGE_MODEL` is optional; when omitted, Smart Storage defaults
to the low-cost `gpt-5.4-nano` model for structured proposal generation.

In Google Cloud Console, add this Authorized redirect URI:

```text
https://your-deployment.convex.site/api/auth/callback/google
```

Use the production Convex site URL for production and the dev Convex site URL
for local development. The Resend sender domain used by `AUTH_EMAIL_FROM` must
be verified in Resend before production email links will deliver reliably.

## Production Deployment

Production is deployed by Vercel from the GitHub `prod` branch. The production
site is `https://logeion.app`, with `www.logeion.app` redirecting to the apex
domain.

### Release workflow

Use `master` as the source branch for ready work and `prod` as the branch Vercel
deploys to production.

1. Merge approved changes into `master`.
2. Update `prod` from `master`:

```bash
git fetch origin
git switch prod
git merge origin/master
```

3. Run the static build before pushing:

```bash
npm ci
npm run build:static
```

4. Push `prod`:

```bash
git push origin prod
```

Every push to `prod` starts a Vercel Production deployment automatically. In
Vercel, the deployment should show:

- Environment: `Production`
- Branch: `prod`
- Aliases: `logeion.app` and `www.logeion.app`

If `master` already contains exactly what should go live, this is the whole
release:

```bash
git fetch origin
git switch prod
git merge origin/master
npm ci
npm run build:static
git push origin prod
```

### Build behavior

The Vercel build uses `vercel.json`, which runs:

```bash
npm run convex:deploy
```

That script deploys the Convex backend first, exposes the production Convex URL
as `VITE_CONVEX_URL`, and then builds the static Vite app into `docs/`.

Do not set `VITE_CONVEX_URL` manually in Vercel. The Convex deploy command
supplies it during the Vercel build.

### Preview deployments

Vercel creates a Preview deployment for non-production branches and pull
requests. This project intentionally skips Preview builds through
`ignoreCommand` in `vercel.json` so branch pushes do not deploy Convex or create
extra preview sites.

If branch previews are needed later, remove the `ignoreCommand` from
`vercel.json`, create a Convex **Preview** deploy key in the Convex dashboard,
and add it to Vercel as `CONVEX_DEPLOY_KEY` for the Preview environment only.
Keep the existing Production deploy key scoped to Production.

### One-time setup

These settings should already be configured for this project, but they are
documented here so production can be rebuilt if needed.

Configure Vercel:

1. Import or connect the GitHub repo to Vercel.
2. In Vercel Project Settings -> Environments -> Production, set Branch
   Tracking to `prod`.
3. In Vercel Project Settings -> Environment Variables, add
   `CONVEX_DEPLOY_KEY` for the Production environment. Create the key from the
   Convex production deployment's deploy key settings.
4. In Vercel Domains, add `logeion.app` and `www.logeion.app`. Connect
   `logeion.app` to Production and redirect `www.logeion.app` to `logeion.app`.

Configure the Convex production environment:

```bash
npx convex env set --prod SITE_URL https://logeion.app
npx convex env set --prod AUTH_GOOGLE_ID your-google-client-id
npx convex env set --prod AUTH_GOOGLE_SECRET your-google-client-secret
npx convex env set --prod AUTH_RESEND_KEY your-resend-api-key
npx convex env set --prod AUTH_EMAIL_FROM "Logeion <signin@your-verified-sending-domain>"
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
