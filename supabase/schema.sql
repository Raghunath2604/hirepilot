create extension if not exists pgcrypto;

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_title text not null,
  job_description text not null,
  resume_text text not null,
  resume_analysis jsonb not null,
  status text not null default 'created' check (status in ('created','technical','technical_complete','hr','completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.interview_rounds (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  round text not null check (round in ('technical','hr')),
  transcript jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique(interview_id,round)
);

create table if not exists public.scorecards (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  round text not null check (round in ('technical','hr')),
  scorecard jsonb not null,
  created_at timestamptz not null default now(),
  unique(interview_id,round)
);

create index if not exists interviews_user_created_idx on public.interviews(user_id,created_at desc);
create index if not exists rounds_interview_idx on public.interview_rounds(interview_id);
create index if not exists scorecards_interview_idx on public.scorecards(interview_id);

alter table public.interviews enable row level security;
alter table public.interview_rounds enable row level security;
alter table public.scorecards enable row level security;

drop policy if exists "interviews owner read" on public.interviews;
drop policy if exists "interviews owner write" on public.interviews;
drop policy if exists "interviews owner update" on public.interviews;
drop policy if exists "interviews owner delete" on public.interviews;
drop policy if exists "rounds owner read" on public.interview_rounds;
drop policy if exists "scorecards owner read" on public.scorecards;

create policy "interviews owner read" on public.interviews for select to authenticated using ((select auth.uid())=user_id);
create policy "interviews owner write" on public.interviews for insert to authenticated with check ((select auth.uid())=user_id);
create policy "interviews owner update" on public.interviews for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "interviews owner delete" on public.interviews for delete to authenticated using ((select auth.uid())=user_id);

create policy "rounds owner read" on public.interview_rounds for select to authenticated using (
  exists (select 1 from public.interviews i where i.id=interview_id and i.user_id=(select auth.uid()))
);

create policy "scorecards owner read" on public.scorecards for select to authenticated using (
  exists (select 1 from public.interviews i where i.id=interview_id and i.user_id=(select auth.uid()))
);

grant select,insert,update,delete on public.interviews to authenticated;
grant select on public.interview_rounds to authenticated;
grant select on public.scorecards to authenticated;
