-- ============================================================
-- App-wide switches an admin can flip
-- ============================================================
-- One row per setting. First use: 'email_login' ({"enabled": true|false}),
-- the "Email sign-in" switch at /admin/login-accounts
-- (lib/auth/email-login-setting.ts). With it off, "Continue with Email" is
-- hidden on the website and in the app, and /api/auth/password refuses.
-- ============================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values ('email_login', '{"enabled": true}')
on conflict (key) do nothing;

-- Only the server (service role) reads or writes it.
alter table public.app_settings enable row level security;
revoke all on public.app_settings from public, anon, authenticated;
grant select, insert, update, delete on public.app_settings to service_role;

notify pgrst, 'reload schema';
