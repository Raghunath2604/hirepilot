# Security Policy

## Reporting vulnerabilities

Please open a private security advisory in GitHub Security tab for this repository.

## Security controls in this project

- Server-only secrets: `OPENAI_API_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`
- Supabase auth via `@supabase/ssr` cookie sessions
- Owner-scoped data access checks and Supabase RLS policies
- Same-origin checks for write endpoints
- Optional distributed rate limiting via Upstash Redis
- Strict input-size validation for job descriptions, resume uploads, and transcripts
- CSP and hardened HTTP security headers in `next.config.mjs`
- Privacy deletion endpoint and retention purge cron endpoint

## Hardening checklist

- Never commit `.env.local` or secret keys
- Rotate secrets immediately if exposed
- Keep dependencies updated and run CI (`lint`, `typecheck`, `build`)
