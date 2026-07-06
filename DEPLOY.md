# Deploying Refr (Railway)

Refr runs as a **persistent Node server** (not serverless) because search uses
Claude + optional local ML models. Railway is the simplest host that runs it
as-is, with a one-click Postgres.

The repo is already configured for this:
- `railway.json` — Nixpacks build, `/login` health check, restart policy.
- `package.json` — `postinstall` runs `prisma generate`; `build` runs
  `prisma generate && next build`; `start` runs `prisma migrate deploy` then
  `next start` on Railway's `$PORT`.
- `next.config.ts` — keeps the ML runtime (`onnxruntime-node`) external.

## One-time setup

### 1. Create the Railway project
1. Go to **railway.app → New Project → Deploy from GitHub repo**.
2. Pick **AkshyaeSingh/refr-talent**. Railway detects Next.js and starts a build.

### 2. Add Postgres (do this BEFORE the first successful deploy)
1. In the project: **New → Database → PostgreSQL**.
2. On the **web service → Variables**, add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`  ← reference the DB service
   (This makes the connection string available at build and run time. Migrations
   run automatically on start via `prisma migrate deploy`.)

### 3. Set the remaining env vars (web service → Variables)
| Variable | Value |
|---|---|
| `AUTH_SECRET` | any long random string |
| `ANTHROPIC_API_KEY` | your `sk-ant-…` key (powers evaluated search + enrichment) |
| `TOKEN_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

Airtable vars come after you have a public URL (step 5).

### 4. Deploy + get the URL
1. Trigger a deploy (push to `main`, or Railway's **Deploy**).
   - Build: `npm ci` → `prisma generate` → `next build`.
   - Start: `prisma migrate deploy` (creates all tables on first run) → `next start`.
2. **Settings → Networking → Generate Domain** → you get e.g.
   `https://refr-talent-production.up.railway.app`.
3. Open it — you should land on `/login`. Sign up to create the first org.

### 5. Airtable OAuth — add the production URL
1. In your Airtable integration (`airtable.com/create/oauth` → your app), add a
   **redirect URL**: `https://<your-domain>/api/oauth/airtable/callback`
   (keep the localhost one too, one per line).
2. On Railway, set:
   - `AIRTABLE_CLIENT_ID`, `AIRTABLE_CLIENT_SECRET`
   - `AIRTABLE_REDIRECT_URI` = `https://<your-domain>/api/oauth/airtable/callback`
   - `AIRTABLE_SCOPES` = `data.records:read schema.bases:read`
3. Redeploy. "Connect with Airtable" now works in production.

## Sharing with other programs
The app is multi-tenant: each program **signs up its own org** at `/signup`,
imports its pool, and connects with others via Friends / Quick Share links.
Just send them the domain. No per-org setup needed.

## Public marketing domain (`/landing`), without buying a domain
`/landing` is a standalone marketing page + waitlist form, meant to be public,
while the real app domain (login/signup/dashboard) stays unpublicized. Railway
gives every **service** its own free `*.up.railway.app` domain, so the cheapest
way to get a second public URL is a second service from the same repo:

1. In the same Railway project: **New → GitHub Repo** → pick this repo again.
   Railway creates a second service from the same code.
2. On that service's **Variables**, set:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (same DB — the waitlist
     table needs to land in the same place as the main app)
   - `LANDING_ONLY` = `true`
   (No `AUTH_SECRET` / `ANTHROPIC_API_KEY` / `TOKEN_ENCRYPTION_KEY` / Airtable
   vars needed — the routes that use them are blocked on this service.)
3. **Settings → Networking → Generate Domain** on this second service → a new
   free `<random>-production.up.railway.app` URL. Share *this* one publicly.
4. `src/middleware.ts` enforces the split: when `LANDING_ONLY=true`, only
   `/landing` and `/api/waitlist` are served — every other path (including
   `/`, `/login`, `/signup`, `/dashboard`) redirects to `/landing`. The main
   app service is untouched (`LANDING_ONLY` unset there), so nothing about
   login/signup changes for approved orgs on the original domain.

This is real route-level isolation (enforced in code), not just an unlinked
URL — but the original app domain is still reachable by anyone who has it, so
treat it as "not publicized," not "secret."

## Notes / production considerations
- **Search works even if the local ML models don't load.** Evaluated search is
  Claude-based; the embedding shortlist degrades to recency if `onnxruntime`
  can't init (e.g. tight memory). So a small instance still works — embeddings
  are an enhancement, not a hard dependency.
- **Model cache is ephemeral.** The ~90MB embedding models re-download on each
  redeploy (first search after a deploy is slow, then warm). To persist them,
  attach a Railway **Volume** and set `HF_HOME`/`TRANSFORMERS_CACHE` to it.
- **Evaluated search latency**: ~30–60s (it makes several Claude calls per
  search, like Juicebox's agent). Fine for v1; streaming results is the next
  optimization.
- **Memory**: if you keep local embeddings, give the service ≥1GB RAM.
- Migrations run on every boot (`migrate deploy`) and are idempotent.
