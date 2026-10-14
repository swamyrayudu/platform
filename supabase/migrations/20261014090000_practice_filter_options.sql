-- Practice filter options, counted in the database.
--
-- The practice filters endpoint used to download every question row and count
-- topics in JavaScript. PostgREST returns at most 1,000 rows per request, so
-- every bank above that size showed a truncated topic list with wrong counts
-- (Social Studies, Telugu medium: 248 topics in the bank, far fewer in the
-- app). This function counts active questions with GROUP BY and returns one
-- JSON document, so no row cap applies.
--
-- Matching follows lib/practice/question-loader.ts, which builds the session,
-- so a count is the number of questions a session can draw from:
--   class level  case-insensitive "contains"
--   topic        exact name; also matches when a comma-joined query string
--                split a name such as "Memory, Forgetting and Assessment"
--   subtopic     exact name, with the same comma handling
--   difficulty   case-insensitive equality
create or replace function public.practice_filter_options(
  p_tables text[], p_count_tables text[],
  p_class_levels text[] default '{}', p_topics text[] default '{}',
  p_subtopics text[] default '{}', p_difficulty text[] default '{}'
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_allowed constant text[] := array[
    'english_subject_questions','telugu_subject_questions','math_english_medium',
    'telugu_medium_math','english_medium_science','telugu_medium_science',
    'socal_english_medium','socal_telugu_medimum','pedagogy_english_medium',
    'pedagogy_subject_questions','gk_english_medium','gk_telugu_medium'
  ];
  v_table text;
  v_count bigint;
  v_table_counts jsonb := '{}';
  v_pool text;
  v_options jsonb;
begin
  p_count_tables := coalesce(p_count_tables, '{}');
  p_class_levels := coalesce(p_class_levels, '{}');
  p_topics := coalesce(p_topics, '{}');
  p_subtopics := coalesce(p_subtopics, '{}');
  p_difficulty := coalesce(p_difficulty, '{}');
  if coalesce(cardinality(p_tables), 0) = 0 or not p_tables <@ v_allowed
    or not p_count_tables <@ v_allowed then
    raise exception 'Invalid question table' using errcode = '22023';
  end if;

  -- Subject totals for the medium: one count per table.
  foreach v_table in array p_count_tables loop
    execute format('select count(*) from public.%I where is_active', v_table) into v_count;
    v_table_counts := v_table_counts || jsonb_build_object(v_table, v_count);
  end loop;

  select string_agg(format(
    'select class_level, topic, subtopic, coalesce(difficulty, %L) as difficulty from public.%I where is_active',
    'Medium', t), ' union all ')
  into v_pool from unnest(p_tables) as t;

  -- Topics and difficulties narrow by class only, so the lists do not shrink
  -- while the user picks from them. The total applies every filter.
  execute format($sql$
    with pool as (%s),
    classed as (
      select * from pool p
      where cardinality($1) = 0 or exists(
        select 1 from unnest($1) as c where strpos(lower(p.class_level), lower(c)) > 0)
    ),
    matched as (
      select 1 from classed p
      -- string_to_array('', ',') is empty, and an empty array is contained in
      -- every array, so blank values are excluded from the split match.
      where (cardinality($2) = 0 or p.topic = any($2) or (p.topic <> '' and string_to_array(p.topic, ',') <@ $2))
        and (cardinality($3) = 0 or p.subtopic = any($3) or (p.subtopic <> '' and string_to_array(p.subtopic, ',') <@ $3))
        and (cardinality($4) = 0 or lower(p.difficulty) in (select lower(d) from unnest($4) as d))
    ),
    topics as (
      select topic as name, count(*) as question_count,
        coalesce(jsonb_agg(distinct subtopic) filter (where subtopic <> ''), '[]') as subtopics
      from classed where topic is not null group by topic
    ),
    difficulties as (
      select difficulty as name, count(*) as question_count from classed group by difficulty
    )
    select jsonb_build_object(
      'classes', (select coalesce(jsonb_agg(distinct class_level), '[]') from pool where class_level <> ''),
      'topics', (select coalesce(jsonb_agg(jsonb_build_object(
          'name', name, 'count', question_count, 'subtopics', subtopics
        ) order by question_count desc, name), '[]') from topics),
      'difficulties', (select coalesce(jsonb_agg(jsonb_build_object(
          'name', name, 'count', question_count)), '[]') from difficulties),
      'total_matching', (select count(*) from matched)
    )
  $sql$, v_pool) into v_options using p_class_levels, p_topics, p_subtopics, p_difficulty;

  return v_options || jsonb_build_object('table_counts', v_table_counts);
end $$;

revoke all on function public.practice_filter_options(text[],text[],text[],text[],text[],text[]) from public, anon, authenticated;
grant execute on function public.practice_filter_options(text[],text[],text[],text[],text[],text[]) to service_role;
notify pgrst, 'reload schema';
