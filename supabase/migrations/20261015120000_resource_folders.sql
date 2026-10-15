-- Resource folders: admins group PDFs, e.g. every previous paper in a
-- "Previous papers" folder. A file is in at most one folder; deleting a
-- folder keeps its files (they move out of the folder).
--
-- Only the server (service role) touches the table: RLS is on, no policies,
-- as for public.resources (20261014150000_resources.sql).

create table if not exists public.resource_folders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Two folders cannot share a name, ignoring case.
create unique index if not exists idx_resource_folders_name on public.resource_folders (lower(name));

alter table public.resource_folders enable row level security;
revoke all on public.resource_folders from public, anon, authenticated;
grant select, insert, update, delete on public.resource_folders to service_role;

alter table public.resources
  add column if not exists folder_id uuid references public.resource_folders(id) on delete set null;
create index if not exists idx_resources_folder on public.resources (folder_id);

notify pgrst, 'reload schema';
