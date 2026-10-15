-- User-made mock tests ("My Tests").
--
-- A user uploads up to 160 questions they prepared, for their own practice.
-- The questions themselves are NOT stored in the database: each test is one
-- gzip-compressed JSON file in the private `user-tests` Storage bucket
-- (path: <user_id>/<test_id>.json.gz; 160 Telugu questions measured ~20 KB).
-- Storage has its own quota, separate from the database. The database keeps
-- only a small row per test and per attempt.
--
-- Only the server (service role) touches these: RLS is on with no policies.

create table if not exists public.user_mock_tests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 120),
  medium           text not null check (medium in ('english', 'telugu')),
  subject          text not null check (char_length(subject) between 1 and 120),
  topics           text[] not null default '{}',
  question_count   integer not null check (question_count between 1 and 160),
  duration_minutes integer not null check (duration_minutes between 1 and 300),
  storage_path     text not null unique,
  size_bytes       integer not null check (size_bytes > 0),
  created_at       timestamptz not null default now(),
  last_attempt_at  timestamptz
);
create index if not exists idx_user_mock_tests_user on public.user_mock_tests (user_id, created_at desc);

create table if not exists public.user_mock_attempts (
  id                 uuid primary key default gen_random_uuid(),
  test_id            uuid not null references public.user_mock_tests(id) on delete cascade,
  user_id            uuid not null references public.users(id) on delete cascade,
  -- One character per question, in order: A-D, or '-' when unanswered.
  answers            text not null check (answers ~ '^[A-D-]{1,160}$'),
  correct_count      integer not null check (correct_count >= 0),
  total_questions    integer not null check (total_questions between 1 and 160),
  time_spent_seconds integer not null check (time_spent_seconds >= 0),
  submitted_at       timestamptz not null default now()
);
create index if not exists idx_user_mock_attempts_test on public.user_mock_attempts (test_id, submitted_at desc);

alter table public.user_mock_tests enable row level security;
alter table public.user_mock_attempts enable row level security;
revoke all on public.user_mock_tests, public.user_mock_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.user_mock_tests, public.user_mock_attempts to service_role;

-- Private bucket: no public URLs; 1 MB per file is far above a 160-question test.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-tests', 'user-tests', false, 1048576, array['application/gzip'])
on conflict (id) do nothing;

notify pgrst, 'reload schema';
