-- ============================================================
-- Email + password sign-in for accounts an admin creates
-- ============================================================
-- Candidates sign in with Google. An admin can also create an account that
-- signs in with an email and a password (for example the reviewer account a
-- store review needs); there is no public sign-up.
--
-- Passwords live in their own table, not on users: users is read with
-- select('*') in many places, and a hash should never travel with those rows.
-- The value is a scrypt hash (lib/auth/password.ts), never the password.
--
-- Accounts made this way still need users.google_id (NOT NULL, UNIQUE); they
-- get 'local:<uuid>', which no Google account id (all digits) can collide with.
-- ============================================================

create table if not exists public.user_passwords (
  user_id       uuid primary key references public.users(id) on delete cascade,
  password_hash text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Only the server (service role) reads or writes it.
alter table public.user_passwords enable row level security;
revoke all on public.user_passwords from public, anon, authenticated;
grant select, insert, update, delete on public.user_passwords to service_role;

notify pgrst, 'reload schema';
