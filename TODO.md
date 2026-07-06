# Refr — TODO / handoff

Talent-sharing platform for AI-safety fellowships & hiring orgs. Next.js 16 + Prisma 7 + local Postgres. Green light theme.

## Run
```
cd ~/projects/talent-flow && npm run dev      # http://localhost:3000
```
Postgres: Homebrew postgresql@16, db `talent_flow`. Login `alice@mats.org` / `password123` (MATS).
AI key is in `.env` (ANTHROPIC_API_KEY). **After any schema change you must restart `npm run dev`** — a long-running dev server holds a stale Prisma client and will 500 on new fields.

## Latest: embedding semantic search (done, verified, pushed 5ed3b0c)
- **Bi-encoder dense retrieval + cross-encoder rerank** (Transformers.js, all-MiniLM-L6-v2 + ms-marco), fully local/no-API, is now the **primary** search over real DB candidates. `src/lib/search/{models,embeddings,pipeline}.ts`, wired in `/api/search` (`searchMode: "semantic"`), consent-gated, keyword/Claude fallback if models fail.
- Per-candidate **embedding cache** keyed by content hash (only changed candidates re-embed). Brute-force cosine now; **ANN (hnswlib-node / pgvector) is the documented scale swap point** in `embeddings.ts`.
- Result cards match the reference UI: rank, big match %, **Program/Org/Focus/Degree** colour-coded pills + legend, summary, muted skills, `cos → rerank` transparency line.
- ⚠️ **Cold start**: first query downloads ~90MB of models (then cached/warm). **Deploy note**: onnxruntime needs enough memory/timeout — a Vercel serverless function may struggle; consider a long-timeout function, a persistent Node server, or running embeddings on a separate service for production.
- Verified: tsc+eslint clean, `searchMode: semantic`, e.g. "interpretability researcher" → Dana Lee 78% (cos 0.35 → rerank 0.78).

## Production deploy (Railway) — ready, see DEPLOY.md
- **`next build` passes** (all routes compile). App is deploy-clean.
- Config committed: `railway.json` (Nixpacks, `/login` healthcheck), `package.json` (`postinstall`→prisma generate, `build`→prisma generate+next build, `start`→migrate deploy+next start on `$PORT`, node ≥20.9).
- **Host = Railway + its Postgres addon** (chosen because the app runs local ML models + needs a warm process; not serverless-friendly). Full steps in `DEPLOY.md`.
- Search degrades gracefully if the embedding models can't load (evaluated path is Claude-based; shortlist falls back to recency) — so it runs on modest instances.
- **Remaining = user actions** (need Railway login): connect GitHub repo → add Postgres + `DATABASE_URL=${{Postgres.DATABASE_URL}}` → set `AUTH_SECRET`/`ANTHROPIC_API_KEY`/`TOKEN_ENCRYPTION_KEY` → deploy → generate domain → add prod URL + `AIRTABLE_*` and redeploy.

## Latest: evaluated search (Juicebox-style, done, pushed)
- Search now: derive criteria from query → embedding shortlist → **LLM judges each candidate per criterion** (met/partial/missing + cited evidence) + 0–100 score. Cards render evidence rows + criteria chips. `deriveCriteria`/`evaluateCandidates` in `lib/ai.ts`, primary path in `/api/search` (`searchMode: "evaluated"`).
- Fixes the "everyone at 0%" problem (raw cross-encoder score was miscalibrated); embedding cross-encoder stays as the no-API fallback.
- Verified on Frame data: "science communicators…" → creators rank above researchers with real evidence.

## Repo + deploying
- Pushed to **github.com/AkshyaeSingh/refr-talent** (`origin/main`). Everything is on `main`.
- Agent branches preserved locally: `claude/zen-hermann-f8347a` (Airtable), `claude/stoic-bhabha-adfd1d` (embedding search). Their worktrees live under `.claude/worktrees/` (ignored by eslint; remove with `git worktree remove` when done).
- ⚠️ **To deploy on Vercel** you need: (1) a **hosted Postgres** (Neon/Supabase/Vercel Postgres) — `DATABASE_URL` currently points at local Postgres, which Vercel can't reach; run `npx prisma migrate deploy` against it. (2) Set env vars in Vercel: `DATABASE_URL`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`, and (for Airtable) `AIRTABLE_CLIENT_ID/SECRET/REDIRECT_URI/SCOPES` + `TOKEN_ENCRYPTION_KEY`. See `.env.example`.

## Latest: merged the two agent branches (done, verified, pushed)
- **Airtable OAuth** (from claude/zen-hermann) ported onto the real Connector model: OAuth2+PKCE connect, tokens encrypted at rest (AES-256-GCM), base/table picker, auto-map+import+enrich on select, sync auto-refreshes tokens. "Connect with Airtable" on Integrations; degrades to a clear "not configured" state without env. Files: `src/lib/crypto.ts`, `src/lib/airtable/*`, `src/app/api/oauth/airtable/*`, `src/app/api/airtable/*`, `src/components/AirtableConnect.tsx`.
- **Faceted search** (from claude/stoic-bhabha) ported over real enriched fields: client-side facet filters (credentials, topics, location, source, audience) with live counts + instant re-narrow, and highlighted credential chips on result cards. In `src/app/dashboard/page.tsx`.
- **Embedding search NOT adopted** — the `@huggingface/transformers` bi/cross-encoder pipeline is a heavy dep (large install, ~90MB model download at first query, ONNX in Node) that duplicates what Claude search + enrichment already do; kept the Claude path. Revisit via the preserved branch if desired.
- Verified: tsc + eslint clean, app runs, Airtable authorize redirects gracefully w/o env, search carries facet fields.

## Latest: brand + marketing pass (done, verified)
- **Purple brand** everywhere (green→purple across all classes + hex + logo/icon/journey; `--accent` now #9333ea).
- **About page** (`/dashboard/about`): one-liner → problem → 2 features each with a **looping animation** (`ConnectAnimation`: pool→Airtable→4 partner orgs; `SearchAnimation`: typed criteria → sources searched → ranked candidates) → tagline. Copy in `src/lib/marketing.ts`.
- **Onboarding step 0** uses the new one-liner + problem + 3 value points + tagline.
- **Quick-share page** (`/share/[token]`) is now **two-column**: left marketing rail (title, tagline, 3 points, "Create your org"/"Log in" CTA) + right request pane with an intro "Share talent →" step before upload/connect.
- Files: `src/lib/marketing.ts`, `src/components/FeatureAnimation.tsx`, `src/app/dashboard/about/page.tsx`, `src/app/onboarding/page.tsx`, `src/app/share/[token]/page.tsx`, `src/app/globals.css`.

## ⚠️ Restart your dev server
Today added new DB columns + routes. Your running server must be restarted to pick them up (Ctrl+C → `npm run dev`).

## Done — latest session (FOUNDATION, verified on real Frame data)
- **Enriched candidate profiles**: Candidate += headline, summary, links(Json), topics[], credentials[], audienceTier, consentToShare, enrichedFields[], profileExtractedAt. Org += logoUrl.
- **AI profile extraction** (`extractProfiles` in `lib/ai.ts`, batched, heuristic fallback) + `CREDENTIAL_TAXONOMY` (MATS, ARENA, SPAR, MARS, LASR, BlueDot/AISF, EA university group, Alignment Forum/LW, PhD, first-author, OSS, AI-safety org, viral creator, founder). `POST /api/enrich` runs it over the pool; auto-fires after each import; manual buttons on Integrations page.
- **Consent**: parsed from the "share with partners" column at ingest (`detectConsent`), refined by AI. Consent-gated: cross-org search and all push/pull/quick-share sharing exclude `consentToShare=false`. Your own pool still shows everyone.
- **Candidate detail** shows the AI profile: headline, summary, highlighted credentials, topics, audience, links, "not shareable" flag, all labelled "AI-summarized".
- **Proven on real Frame cohort**: e.g. shalina prakash → BlueDot/AISF + EA university group; Andres Nino → Viral creator (100k+), Founder. import→enrich→credentials/topics/consent all populate.

## Do next (staged — all designed, not yet built)
- [ ] **#34 Search redesign**: remove the structured criteria panel → pure natural-language box; after results, Juicebox-style **faceted filters** (topics, credentials, location, source org, audience) + **highlighted credential chips** on each card. (Biggest UX win; search page is large — do as focused pass.)
- [ ] **#35 All Talent** left-nav page: whole accessible pool (own + friends' consented) combined, deduped, with the same facets.
- [ ] **#36 Logo upload** on profile (Org.logoUrl exists) → show in sidebar/friends cards. + candidate profile polish.
- [ ] **#37 Quick-share "Learn more about Refr"** button on `/share/[token]` → about view + sign up/login. + **criteria doc upload** in search (attach txt/md/pdf instead of typing).
- [ ] **#38 Journey graph "Simulator view"** toggle: rich fake data, mature comprehensive network.
- [ ] **#39 Airtable/Typeform OAuth** (replace API-key paste): needs a registered dev app (client id/secret + redirect URI in `.env`) — will scaffold authorize→callback→token→base-picker, gated on those creds. + AI web enrichment (fill gaps from LinkedIn/web, labelled AI-inferred).

## Airtable/Typeform OAuth — what YOU must register (once)
1. Airtable: create an OAuth integration → client id + secret, redirect URI `http://localhost:3000/api/oauth/airtable/callback`, scopes `data.records:read schema.bases:read`.
2. Typeform: OAuth app → client id/secret, redirect, scope `responses:read`.
3. Put the four creds in `.env`. Then the "Connect" buttons do a real redirect flow (no API keys for end users).

## Profile fields worth showing per applicant (AI-safety space)
Identity+reach (links, audience tier, platform), headline+summary, topics, **credentials/signals** (programs: MATS/ARENA/SPAR/BlueDot/EA-club; outputs: Alignment Forum/LW, first-author, OSS; employer: Apollo/Redwood/Anthropic), journey pipeline, consent, and AI-inferred fields clearly labelled.

## Key files (this session)
- `prisma/schema.prisma` (Candidate enrichment, Org.logoUrl), `src/lib/ai.ts` (extractProfiles + taxonomy), `src/lib/ingest.ts` (detectConsent), `src/app/api/enrich/route.ts`, `src/app/api/search/route.ts` (consent gate), `src/app/api/share/route.ts` (consent gate), `src/components/ImportPanel.tsx` (auto-enrich), `src/app/dashboard/candidate/[id]/page.tsx` (profile display), `src/app/dashboard/integrations/page.tsx` (analyze buttons).
