-- Shared, recoverable new-question imports. Neither browser role can read backups.
create table public.admin_question_import_batches (
  id uuid primary key,
  question_table text not null,
  actor_id uuid references public.users(id) on delete set null,
  last_actor_id uuid references public.users(id) on delete set null,
  fingerprint text not null,
  origin text not null check (origin in ('import', 'recovery')),
  status text not null default 'applied' check (status in ('applied', 'undone')),
  row_count integer not null check (row_count between 1 and 500),
  rows jsonb not null check (jsonb_typeof(rows) = 'array'),
  topics jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  changed_at timestamptz not null default now()
);
create index admin_import_history_idx on public.admin_question_import_batches (question_table, created_at desc, id desc);
create index admin_import_actor_idx on public.admin_question_import_batches (actor_id);
create index admin_import_last_actor_idx on public.admin_question_import_batches (last_actor_id);
create index admin_import_topics_idx on public.admin_question_import_batches using gin (topics);
-- Retain identities after Undo, so a later import can never reuse a backed-up ID.
create table public.admin_question_import_ids (
  question_table text not null,
  question_id text not null,
  batch_id uuid not null references public.admin_question_import_batches(id),
  primary key (question_table, question_id)
);
create index admin_import_ids_batch_idx on public.admin_question_import_ids (batch_id);
alter table public.admin_question_import_batches enable row level security;
alter table public.admin_question_import_ids enable row level security;
revoke all on public.admin_question_import_batches, public.admin_question_import_ids from public, anon, authenticated;
grant all on public.admin_question_import_batches, public.admin_question_import_ids to service_role;
create policy service_admin_import_batches on public.admin_question_import_batches to service_role using (true) with check (true);
create policy service_admin_import_ids on public.admin_question_import_ids to service_role using (true) with check (true);

create function public.check_admin_import_scope(p_actor_id uuid, p_table text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.users where id = p_actor_id and role = 'admin') then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_table is null or p_table <> all(array[
    'english_subject_questions','telugu_subject_questions','math_english_medium','telugu_medium_math',
    'english_medium_science','telugu_medium_science','socal_english_medium','socal_telugu_medimum',
    'pedagogy_english_medium','pedagogy_subject_questions','gk_english_medium','gk_telugu_medium',
    'dsc_practice_questions','mathematics_subject_questions','social_subject_questions'
  ]) then raise exception 'Unknown question table'; end if;
end $$;

-- Preview and Apply perform the same checks; Apply repeats them under locks.
create function public.admin_question_import_action(
  p_actor_id uuid, p_table text, p_batch_id uuid, p_action text, p_apply boolean, p_preview_rows jsonb default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  b public.admin_question_import_batches%rowtype;
  r jsonb; current_row jsonb; reason text; used boolean; uid text; qid text;
  columns_sql text; values_sql text; output jsonb;
begin
  perform public.check_admin_import_scope(p_actor_id, p_table);
  if p_action is null or p_action not in ('undo','restore') or p_apply is null then raise exception 'Invalid import action'; end if;
  -- Same order for all mutations: bank, then ledger, then individual rows.
  execute format('lock table public.%I in share row exclusive mode', p_table);
  select * into b from public.admin_question_import_batches where id = p_batch_id and question_table = p_table for update;
  if not found then
    if p_apply or p_action <> 'undo' or jsonb_typeof(p_preview_rows) is distinct from 'array' or jsonb_array_length(p_preview_rows) not between 1 and 500 then raise exception 'Import not found'; end if;
    b.id := p_batch_id; b.rows := p_preview_rows; b.status := 'applied'; b.row_count := jsonb_array_length(p_preview_rows);
  end if;
  if (p_action = 'undo' and b.status = 'applied') or (p_action = 'restore' and b.status = 'undone') then
    for r in select value from jsonb_array_elements(b.rows) order by value->>'question_id' loop
      qid := r->>'question_id'; uid := p_table || ':' || qid;
      execute format('select to_jsonb(q) from public.%I q where question_id = $1 for update', p_table) into current_row using qid;
      if p_action = 'undo' then
        if current_row is distinct from r then reason := 'A question was edited or removed after this import. Undo is blocked to protect later changes.'; exit; end if;
        -- Canonical IDs are scoped; legacy bare IDs are checked conservatively.
        select exists (select 1 from public.mock_test_questions where question_uid = uid or (question_table = p_table and question_id = qid))
          or exists (select 1 from public.mock_question_usage where question_uid = uid or (question_table = p_table and question_id = qid))
          or exists (select 1 from public.mock_test_answers where question_id in (uid, qid))
          or exists (select 1 from public.practice_sessions where question_ids && array[uid, qid])
          or exists (select 1 from public.question_attempts where question_id in (uid, qid))
          or exists (select 1 from public.question_progress where question_id in (uid, qid))
          or exists (select 1 from public.question_usage where question_id in (uid, qid))
          or exists (select 1 from public.question_feedback where question_uid = uid or (question_table = p_table and question_id = qid))
          or exists (select 1 from public.question_feedback_reports where question_uid = uid) into used;
        if used then reason := 'These questions are already used in practice, mock tests or feedback. Undo is blocked to preserve student history. Correct their topic in Bulk update instead.'; exit; end if;
      else
        if current_row is not null then reason := 'A backed-up question ID already exists. Restore cannot overwrite it.'; exit; end if;
        execute format('select exists(select 1 from public.%I where lower(regexp_replace(btrim(question), ''\s+'', '' '', ''g'')) = lower(regexp_replace(btrim($1), ''\s+'', '' '', ''g'')))', p_table) into used using r->>'question';
        if used then reason := 'A question with the same text already exists. Restore would create a duplicate.'; exit; end if;
      end if;
    end loop;
  end if;
  if p_apply and reason is not null then raise exception '%', reason using errcode = '40001'; end if;
  if p_apply and ((p_action = 'undo' and b.status = 'applied') or (p_action = 'restore' and b.status = 'undone')) then
    if p_action = 'undo' then
      execute format('delete from public.%I where question_id in (select value->>''question_id'' from jsonb_array_elements($1))', p_table) using b.rows;
      delete from public.admin_question_reviews where question_table = p_table and question_id in (select value->>'question_id' from jsonb_array_elements(b.rows));
    else
      -- Full database snapshots preserve internal UUIDs, original question IDs and defaults.
      select string_agg(format('%I', a.attname), ',' order by a.attnum),
        string_agg(format('x.%I', a.attname), ',' order by a.attnum)
      into columns_sql, values_sql from pg_catalog.pg_attribute a
      where a.attrelid = format('public.%I', p_table)::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = '';
      execute format('insert into public.%I (%s) overriding system value select %s from jsonb_populate_recordset(null::public.%I, $1) x', p_table, columns_sql, values_sql, p_table) using b.rows;
    end if;
    update public.admin_question_import_batches set status = case when p_action = 'undo' then 'undone' else 'applied' end,
      changed_at = clock_timestamp(), last_actor_id = p_actor_id where id = b.id returning * into b;
  end if;
  select jsonb_agg(jsonb_build_object('question_id', value->>'question_id','question',value->>'question','topic',value->'topic')) into output from jsonb_array_elements(b.rows);
  return jsonb_build_object('success',true,'applied',p_apply,'eligible',reason is null,'reason',reason,
    'status',b.status,'count',b.row_count,'rows',output,'batchId',b.id,'action',p_action);
end $$;

create function public.capture_admin_question_import(
  p_request_id uuid, p_fingerprint text, p_actor_id uuid, p_table text,
  p_rows jsonb, p_result jsonb, p_origin text default 'import'
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  b public.admin_question_import_batches%rowtype;
  r jsonb; snapshot jsonb; snapshots jsonb := '[]'::jsonb; topics jsonb;
  columns_sql text; values_sql text; result jsonb; duplicate boolean;
begin
  perform public.check_admin_import_scope(p_actor_id, p_table);
  if p_request_id is null or p_fingerprint is null or p_origin is null or p_origin not in ('import','recovery')
    or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'Invalid import batch'; end if;
  execute format('lock table public.%I in share row exclusive mode', p_table);
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into b from public.admin_question_import_batches where id = p_request_id;
  if found then
    if b.question_table <> p_table or b.fingerprint <> p_fingerprint then raise exception 'This request belongs to another import'; end if;
    if b.status = 'undone' and p_origin = 'import' then raise exception 'This import was undone. Use Restore in import history.'; end if;
    return b.result;
  end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    if coalesce(r->>'question_id','') = '' or exists (select 1 from public.admin_question_import_ids where question_table = p_table and question_id = r->>'question_id') then
      raise exception 'An ID already belongs to another import. Use its import history or preview again.' using errcode = '23505';
    end if;
    if p_origin = 'recovery' then
      execute format('select to_jsonb(q) from public.%I q where question_id = $1 for update', p_table) into snapshot using r->>'question_id';
      if snapshot is distinct from r then raise exception 'A question changed since preview. Preview again.' using errcode = '40001'; end if;
    else
      if exists (select 1 from jsonb_object_keys(r) k where k <> all(array['question_id','question','option_a','option_b','option_c','option_d','correct_answer','explanation','topic','subtopic','chapter','difficulty','class_level'])) then raise exception 'Unsupported import column'; end if;
      if coalesce(r->>'question','') = '' or coalesce(r->>'option_a','') = '' or coalesce(r->>'option_b','') = '' or coalesce(r->>'option_c','') = '' or coalesce(r->>'option_d','') = '' or coalesce(r->>'correct_answer','') not in ('A','B','C','D') then raise exception 'Invalid question'; end if;
      execute format('select exists(select 1 from public.%I where lower(regexp_replace(btrim(question), ''\s+'', '' '', ''g'')) = lower(regexp_replace(btrim($1), ''\s+'', '' '', ''g'')))', p_table) into duplicate using r->>'question';
      if duplicate then raise exception 'Duplicate question text. Preview again.' using errcode = '23505'; end if;
      select string_agg(format('%I', key), ',' order by key), string_agg(format('x.%I', key), ',' order by key)
      into columns_sql, values_sql from jsonb_object_keys(r) key;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) x returning to_jsonb(%I.*)', p_table, columns_sql, values_sql, p_table, p_table) into snapshot using r;
    end if;
    snapshots := snapshots || jsonb_build_array(snapshot);
  end loop;
  select jsonb_agg(distinct value->'topic') into topics from jsonb_array_elements(snapshots);
  result := p_result || jsonb_build_object('importBatchId',p_request_id);
  insert into public.admin_question_import_batches(id,question_table,actor_id,last_actor_id,fingerprint,origin,row_count,rows,topics,result)
    values(p_request_id,p_table,p_actor_id,p_actor_id,p_fingerprint,p_origin,jsonb_array_length(snapshots),snapshots,topics,result);
  insert into public.admin_question_import_ids select p_table,value->>'question_id',p_request_id from jsonb_array_elements(snapshots);
  if p_origin = 'recovery' then
    result := public.admin_question_import_action(p_actor_id,p_table,p_request_id,'undo',true);
    update public.admin_question_import_batches set result = capture_admin_question_import.result || jsonb_build_object('importBatchId',p_request_id) where id = p_request_id;
    return result || jsonb_build_object('importBatchId',p_request_id);
  end if;
  return result;
end $$;

revoke all on function public.check_admin_import_scope(uuid,text), public.admin_question_import_action(uuid,text,uuid,text,boolean,jsonb), public.capture_admin_question_import(uuid,text,uuid,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.check_admin_import_scope(uuid,text), public.admin_question_import_action(uuid,text,uuid,text,boolean,jsonb), public.capture_admin_question_import(uuid,text,uuid,text,jsonb,jsonb,text) to service_role;
