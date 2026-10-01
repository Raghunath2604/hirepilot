# HirePilot AI

HirePilot is a production-oriented Next.js App Router application for private interview coaching with:

- Resume upload + role/job analysis (OpenAI Responses API structured JSON)
- Two sequential rounds (`technical` then `hr`) in a live voice interview room (OpenAI Realtime WebRTC)
- Transcript capture and round scorecards
- Supabase persistence, dashboard history, and report views

## Stack

- Next.js + TypeScript (strict)
- Supabase Postgres + `@supabase/ssr` auth cookies
- OpenAI Responses + Realtime APIs

## Local setup

1. Install dependencies

```bash
npm install
```

2. Copy environment template

```bash
cp .env.example .env.local
```

3. Fill required values in `.env.local`

- `OPENAI_API_KEY`
- `OPENAI_SAFETY_HMAC_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-only)
- `CRON_SECRET`

4. Apply Supabase schema in your project SQL editor:

```sql
-- run contents of supabase/schema.sql
```

5. Run app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Production / Vercel

- Add all environment variables from `.env.example` in Vercel Project Settings.
- Keep `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, and `CRON_SECRET` server-only.
- Configure Vercel cron to call `/api/cron/purge` (already present in `vercel.json`).
- Deploy and validate `/api/health` returns `200`.

## API overview

- `POST /api/analyze` – upload resume and create interview
- `GET /api/interviews` – list user interviews
- `GET /api/interviews/:id` – read interview details
- `POST /api/interviews/:id/round` – start technical/hr round (hr requires technical score)
- `POST /api/interviews/:id/realtime` – create ephemeral realtime session token
- `POST /api/score` – persist transcript and save round scorecard
- `POST|DELETE /api/privacy/delete` – delete current user interview data
- `GET /api/cron/purge` – retention purge (bearer `CRON_SECRET`)
- `GET /api/health` – readiness

## Validation scripts

```bash
npm run lint
npm run typecheck
npm run build
```

## Notes

- No hiring decision or ranking is produced.
- Protected attributes are excluded from analysis/scoring logic.
- Missing environment values fail APIs clearly instead of pretending success.
