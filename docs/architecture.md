# HirePilot Architecture

HirePilot is a Next.js App Router application with server-side APIs for resume analysis, interview session orchestration, transcript scoring, and persistence.

## Core flow

1. Authenticated user uploads resume + role + job description on `/`.
2. `POST /api/analyze` validates input, enforces rate limits, calls OpenAI Responses API with strict JSON schema, stores interview record.
3. User enters `/interview/[id]`, starts `technical` then `hr` round.
4. `POST /api/interviews/[id]/realtime` verifies interview ownership and round gating, then creates OpenAI Realtime session server-side.
5. Browser performs WebRTC SDP exchange directly with OpenAI using ephemeral client secret and streams microphone audio.
6. Transcript events are captured in UI and persisted/scored via `POST /api/score`.
7. Dashboard and report pages read interview history and scorecards via authenticated APIs.

## Data model

Supabase Postgres tables:

- `interviews` – owner, role/jd, resume analysis, status
- `interview_rounds` – transcript and timing per round
- `scorecards` – structured score results per round

RLS policies in `supabase/schema.sql` scope access to `auth.uid()` owner.

## Security controls

- Cookie-based Supabase auth with `@supabase/ssr`
- No OpenAI or Supabase secret key in browser
- Same-origin checks on write endpoints
- Optional Upstash-backed rate limit hook
- CSP and hardened headers in `next.config.mjs`
- Privacy delete endpoint and retention purge cron endpoint
- Health endpoint for environment readiness
