# HirePilot AI

HirePilot AI is a production-oriented interview-preparation platform that turns a resume and target role into an evidence-backed recruiter brief and two live AI voice interview rounds.

## Flow

1. Candidate authenticates.
2. Candidate uploads a resume and supplies a target role/job description.
3. Server-side OpenAI analysis extracts ATS keywords, matched skills, evidence gaps, projects, and interview focus.
4. A protected interview room is created.
5. Technical round: role fundamentals, implementation, debugging, architecture, trade-offs, and project depth.
6. HR/Behavioral round: ownership, teamwork, conflict, failure, learning, prioritization, communication, and motivation.
7. Each round produces a structured 1-5 coaching scorecard with transcript evidence.
8. Final report shows the ATS context and round scorecards.

## Local setup

Copy `.env.example` to `.env.local` and fill in the secrets locally. Never commit `.env.local`.

Required:
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:
- Upstash rate limiting
- Zapier scorecard webhook

Install and run:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npm run dev
```

## GitHub secret

For GitHub Actions, create a GitHub Environment named `production` and add:

`OPENAI_API_KEY`

as an Environment secret. The repository contains a manual workflow that verifies the secret exists without printing its value.

Do not put the real key in:
- source files;
- `.env.example`;
- GitHub commits;
- pull requests;
- logs;
- client-side `NEXT_PUBLIC_*` variables.

## Supabase

Run `supabase/schema.sql` in the Supabase SQL editor. Keep service/secret credentials server-side. RLS is required for user isolation.

## Production

Set the same secrets in the deployment platform's secret manager. Configure the Supabase Auth redirect URL to the deployed application origin. Configure retention, rate limits, and Zapier webhook only after validating privacy requirements.

## Security

See SECURITY.md.


## Voice architecture

The browser authenticates to HirePilot, requests a short-lived Realtime client secret from `/api/realtime-token`, then connects directly to OpenAI's `/v1/realtime/calls` endpoint using WebRTC. The session uses GPT-Realtime-2.1 with semantic VAD and the `marin` voice. The permanent OpenAI API key never reaches the browser.

## Production smoke test

GitHub Actions includes a manual `Production Realtime Smoke Test` workflow. Run it from the Actions tab with the `production` Environment selected to verify that `OPENAI_API_KEY` can mint a Realtime client secret without printing the credential.
