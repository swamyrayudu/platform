-- Resources: PDFs admins publish for candidates — books, study material,
-- bit banks, previous papers.
--
-- Files live in the private `resources` Storage bucket. Storage itself
-- enforces the 10 MB limit and PDF-only type, so neither can be bypassed by
-- calling the upload URL directly. Candidates never get a permanent link: the
-- server checks Free/Pro access and hands out a signed URL that expires.
--
-- Only the server (service role) touches the table: RLS is on, no policies.

create table if not exists public.resources (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (char_length(title) between 1 and 200),
  description    text not null default '' check (char_length(description) <= 2000),
  category       text not null check (category in ('book', 'study_material', 'bit_bank', 'previous_paper', 'other')),
  subject        text not null default 'All' check (char_length(subject) between 1 and 120),
  medium         text not null default 'both' check (medium in ('english', 'telugu', 'both')),
  access         text not null default 'free' check (access in ('free', 'pro')),
  storage_path   text not null unique,
  file_name      text not null check (char_length(file_name) between 1 and 200),
  size_bytes     integer not null check (size_bytes between 1 and 10485760),
  is_published   boolean not null default true,
  download_count integer not null default 0,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_resources_listing on public.resources (is_published, category, created_at desc);

alter table public.resources enable row level security;
revoke all on public.resources from public, anon, authenticated;
grant select, insert, update, delete on public.resources to service_role;

-- Opens and downloads, counted without a read-modify-write race.
create or replace function public.increment_resource_downloads(p_id uuid)
returns void language sql security invoker set search_path = '' as $$
  update public.resources set download_count = download_count + 1 where id = p_id;
$$;
revoke all on function public.increment_resource_downloads(uuid) from public, anon, authenticated;
grant execute on function public.increment_resource_downloads(uuid) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resources', 'resources', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

notify pgrst, 'reload schema';
