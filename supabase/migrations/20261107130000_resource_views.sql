-- Resource views: which candidate opened which resource, for the admin user page.
--
-- One row per (user, resource), bumped atomically on every open, so the
-- table stays small no matter how often a file is reopened. Written where
-- the server signs the PDF link (createAccessUrl), which both the website
-- and the Android app go through, so every real open is counted once.
--
-- blocked_count: a Free user tried to open a Pro resource (the link was refused).
-- Only the server (service role) touches the table: RLS is on, no policies.

create table if not exists public.resource_views (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  resource_id     uuid not null references public.resources(id) on delete cascade,
  open_count      integer not null default 0 check (open_count >= 0),
  blocked_count   integer not null default 0 check (blocked_count >= 0),
  first_opened_at timestamptz,
  last_opened_at  timestamptz,
  -- Latest open OR blocked attempt; the admin list is ordered by this.
  last_seen_at    timestamptz not null default now(),
  -- WEB | ANDROID | IOS of the latest attempt
  last_platform   text,
  created_at      timestamptz not null default now(),
  constraint uq_resource_views_user_resource unique (user_id, resource_id)
);
create index if not exists idx_resource_views_user on public.resource_views (user_id, last_seen_at desc);
create index if not exists idx_resource_views_resource on public.resource_views (resource_id);

alter table public.resource_views enable row level security;
revoke all on public.resource_views from public, anon, authenticated;
grant select, insert, update, delete on public.resource_views to service_role;

create or replace function public.record_resource_view(
  p_user_id uuid, p_resource_id uuid, p_platform text, p_blocked boolean
) returns void language sql security invoker set search_path = '' as $$
  insert into public.resource_views as v
    (user_id, resource_id, open_count, blocked_count, first_opened_at, last_opened_at, last_seen_at, last_platform)
  values (
    p_user_id, p_resource_id,
    case when p_blocked then 0 else 1 end,
    case when p_blocked then 1 else 0 end,
    case when p_blocked then null else now() end,
    case when p_blocked then null else now() end,
    now(), p_platform
  )
  on conflict (user_id, resource_id) do update set
    open_count      = v.open_count + case when p_blocked then 0 else 1 end,
    blocked_count   = v.blocked_count + case when p_blocked then 1 else 0 end,
    first_opened_at = case when p_blocked then v.first_opened_at else coalesce(v.first_opened_at, now()) end,
    last_opened_at  = case when p_blocked then v.last_opened_at else now() end,
    last_seen_at    = now(),
    last_platform   = p_platform;
$$;
revoke all on function public.record_resource_view(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.record_resource_view(uuid, uuid, text, boolean) to service_role;

notify pgrst, 'reload schema';
