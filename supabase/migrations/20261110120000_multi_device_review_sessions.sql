-- ============================================================
-- Let admin-made email accounts stay signed in on several devices
-- ============================================================
-- Students (Google sign-in) keep ONE active session: signing in on a new
-- device ends the old one. That breaks store review: Google signs in to the
-- reviewer account on several devices at once (human reviewers plus the
-- pre-launch report), and each sign-in would log the others out.
--
-- Accounts an admin makes at /admin/login-accounts (users.google_id
-- 'local:<uuid>') now get sessions flagged multi_device. Those are limited to
-- one active session per DEVICE instead of one per user. The flag lives on
-- sessions because a partial index cannot look at the users table.
--
-- Turning email sign-in off, changing or removing the password still revokes
-- every active session of the account (lib/auth/password-accounts.ts).
-- ============================================================

alter table public.sessions
  add column if not exists multi_device boolean not null default false;

-- Single-device accounts: still one ACTIVE session per user.
drop index if exists public.sessions_one_active_per_user;
create unique index if not exists sessions_one_active_per_user
  on public.sessions(user_id)
  where status = 'ACTIVE' and not multi_device;

-- Multi-device accounts: one ACTIVE session per user and device.
create unique index if not exists sessions_one_active_per_user_device
  on public.sessions(user_id, device_id)
  where status = 'ACTIVE' and multi_device;

notify pgrst, 'reload schema';
