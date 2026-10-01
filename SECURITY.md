# HirePilot AI Security Checklist

## Secrets
- Never commit `.env` files.
- `.env.example` contains placeholders only.
- Never hardcode OpenAI, Supabase, Redis, webhook, or authentication credentials.
- Store `OPENAI_API_KEY` as a GitHub Environment secret named `production` and inject it through `${{ secrets.OPENAI_API_KEY }}` only when needed.
- Never log secret values.

## Authentication and authorization
- Authenticate server-side with Supabase.
- Never trust a frontend user ID for authorization.
- Load the authenticated user from the server session and scope every interview query to that user.
- Keep admin-only functionality out of candidate routes.
- Use RLS as the database authorization layer.

## Database and storage
- RLS is enabled for interview, round, and scorecard tables.
- Policies are owner-scoped.
- Supabase secret/service-role credentials are server-only.
- Use parameterized Supabase queries rather than building SQL strings.
- Do not store raw uploaded resume binaries unless a future feature explicitly requires it and has dedicated storage policies.

## File uploads
- Enforce maximum size server-side.
- Allow only expected resume extensions/content types.
- Never execute or serve uploaded files as application code.
- Parse documents as untrusted data.

## AI and user content
- Resume text, job descriptions, transcripts, and candidate answers are untrusted inputs.
- Treat uploaded content as data, not instructions.
- Do not allow candidate-controlled text to overwrite recruiter system instructions.
- Never invent resume claims.
- Never use protected characteristics.
- Never turn coaching scores into an automated employment decision.

## Browser and network security
- Security headers and CSP are configured in Next.js.
- Microphone access is limited to the application origin.
- Realtime sessions are created only after server-side interview ownership checks.
- Keep permanent OpenAI credentials off the browser.

## Abuse prevention
- Rate limiting is supported through Upstash when configured.
- Authentication endpoints should also use Supabase Auth protections such as CAPTCHA/rate limits in production.
- Validate all request bodies and transcript size server-side.
- Protect cron endpoints with a secret.
- Return generic production errors instead of stack traces.

## Git history
CI includes a secret scanner that examines repository contents and git history. If a credential is ever committed, revoke/rotate it immediately and remove it from history using a controlled repository rewrite.

## Testing
Run the application as an untrusted user:
- attempt another user's interview URL;
- send malformed API payloads;
- upload oversized/invalid files;
- attempt prompt injection through resume/JD/transcript text;
- attempt to access server-only environment variables;
- call protected routes without authentication;
- verify deletion and retention behavior;
- verify the browser never receives the permanent OpenAI key.
