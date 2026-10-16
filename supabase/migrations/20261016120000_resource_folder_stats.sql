-- Resource counts per folder, for the candidate Resources page: the page loads
-- only folders with their counts, and a folder's files when it is opened.
--
-- A plain view, not a materialized one: counts must change the moment an admin
-- uploads, hides or deletes a file, and a materialized view would show stale
-- numbers until refreshed (needing a refresh trigger on every write). The
-- table is small and the index below makes this count a quick index scan, so
-- a live view is both simpler and always correct.
--
-- folder_id is null for files in no folder. A file for both mediums counts
-- in english_count and telugu_count.

create index if not exists idx_resources_published_folder
  on public.resources (folder_id) where is_published;

create or replace view public.resource_folder_stats
with (security_invoker = true) as
select
  folder_id,
  count(*)::int                                            as file_count,
  count(*) filter (where medium in ('english', 'both'))::int as english_count,
  count(*) filter (where medium in ('telugu', 'both'))::int  as telugu_count
from public.resources
where is_published
group by folder_id;

-- Only the server (service role) reads it, as for public.resources.
revoke all on public.resource_folder_stats from public, anon, authenticated;
grant select on public.resource_folder_stats to service_role;

notify pgrst, 'reload schema';
