-- Check whole batches once to keep 160–500-question actions within API timeouts.
create or replace function public.admin_question_import_action(
  p_actor_id uuid, p_table text, p_batch_id uuid, p_action text, p_apply boolean, p_preview_rows jsonb default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  b public.admin_question_import_batches%rowtype;
  reason text; used boolean; qids text[]; uids text[]; identities text[]; stems text[];
  columns_sql text; values_sql text; output jsonb;
begin
  perform public.check_admin_import_scope(p_actor_id, p_table);
  if p_action is null or p_action not in ('undo','restore') or p_apply is null then raise exception 'Invalid import action'; end if;
  execute format('lock table public.%I in share row exclusive mode', p_table);
  select * into b from public.admin_question_import_batches where id = p_batch_id and question_table = p_table for update;
  if not found then
    if p_apply or p_action <> 'undo' or jsonb_typeof(p_preview_rows) is distinct from 'array' or jsonb_array_length(p_preview_rows) not between 1 and 500 then raise exception 'Import not found'; end if;
    b.id := p_batch_id; b.rows := p_preview_rows; b.status := 'applied'; b.row_count := jsonb_array_length(p_preview_rows);
  end if;
  select array_agg(value->>'question_id'), array_agg(p_table || ':' || (value->>'question_id')),
    array_agg(lower(regexp_replace(btrim(value->>'question'), '\s+', ' ', 'g')))
    into qids, uids, stems from jsonb_array_elements(b.rows);
  identities := qids || uids;
  if p_action = 'undo' and b.status = 'applied' then
    -- A single locked bank comparison replaces hundreds of per-row scans.
    execute format('select exists(select 1 from jsonb_array_elements($1) s left join public.%I q on q.question_id = s.value->>''question_id'' where to_jsonb(q) is distinct from s.value)', p_table) into used using b.rows;
    if used then
      reason := 'A question was edited or removed after this import. Undo is blocked to protect later changes.';
    else
      select exists (select 1 from public.mock_test_questions where question_uid = any(uids) or (question_table = p_table and question_id = any(qids)))
        or exists (select 1 from public.mock_question_usage where question_uid = any(uids) or (question_table = p_table and question_id = any(qids)))
        or exists (select 1 from public.mock_test_answers where question_id = any(identities))
        or exists (select 1 from public.practice_sessions where question_ids && identities)
        or exists (select 1 from public.question_attempts where question_id = any(identities))
        or exists (select 1 from public.question_progress where question_id = any(identities))
        or exists (select 1 from public.question_usage where question_id = any(identities))
        or exists (select 1 from public.question_feedback where question_uid = any(uids) or (question_table = p_table and question_id = any(qids)))
        or exists (select 1 from public.question_feedback_reports where question_uid = any(uids)) into used;
      if used then reason := 'These questions are already used in practice, mock tests or feedback. Undo is blocked to preserve student history. Correct their topic in Bulk update instead.'; end if;
    end if;
  elsif p_action = 'restore' and b.status = 'undone' then
    execute format('select exists(select 1 from public.%I where question_id = any($1))', p_table) into used using qids;
    if used then
      reason := 'A backed-up question ID already exists. Restore cannot overwrite it.';
    else
      -- Normalize each bank stem once, rather than once per backed-up question.
      execute format('select exists(select 1 from public.%I where lower(regexp_replace(btrim(question), ''\s+'', '' '', ''g'')) = any($1))', p_table) into used using stems;
      if used then reason := 'A question with the same text already exists. Restore would create a duplicate.'; end if;
    end if;
  end if;
  if p_apply and reason is not null then raise exception '%', reason using errcode = '40001'; end if;
  if p_apply and ((p_action = 'undo' and b.status = 'applied') or (p_action = 'restore' and b.status = 'undone')) then
    if p_action = 'undo' then
      execute format('delete from public.%I where question_id = any($1)', p_table) using qids;
      delete from public.admin_question_reviews where question_table = p_table and question_id = any(qids);
    else
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

create or replace function public.capture_admin_question_import(
  p_request_id uuid, p_fingerprint text, p_actor_id uuid, p_table text,
  p_rows jsonb, p_result jsonb, p_origin text default 'import'
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  b public.admin_question_import_batches%rowtype;
  r jsonb; snapshot jsonb; snapshots jsonb := '[]'::jsonb; topics jsonb;
  columns_sql text; values_sql text; saved_result jsonb; duplicate boolean; stems text[];
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
  if p_origin = 'import' then
    select array_agg(lower(regexp_replace(btrim(value->>'question'), '\s+', ' ', 'g'))) into stems from jsonb_array_elements(p_rows);
    if cardinality(stems) <> (select count(distinct stem) from unnest(stems) stem) then
      raise exception 'Duplicate question text. Preview again.' using errcode = '23505';
    end if;
    execute format('select exists(select 1 from public.%I where lower(regexp_replace(btrim(question), ''\s+'', '' '', ''g'')) = any($1))', p_table) into duplicate using stems;
    if duplicate then raise exception 'Duplicate question text. Preview again.' using errcode = '23505'; end if;
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
      select string_agg(format('%I', key), ',' order by key), string_agg(format('x.%I', key), ',' order by key)
      into columns_sql, values_sql from jsonb_object_keys(r) key;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) x returning to_jsonb(%I.*)', p_table, columns_sql, values_sql, p_table, p_table) into snapshot using r;
    end if;
    snapshots := snapshots || jsonb_build_array(snapshot);
  end loop;
  select jsonb_agg(distinct value->'topic') into topics from jsonb_array_elements(snapshots);
  saved_result := p_result || jsonb_build_object('importBatchId',p_request_id);
  insert into public.admin_question_import_batches(id,question_table,actor_id,last_actor_id,fingerprint,origin,row_count,rows,topics,result)
    values(p_request_id,p_table,p_actor_id,p_actor_id,p_fingerprint,p_origin,jsonb_array_length(snapshots),snapshots,topics,saved_result);
  insert into public.admin_question_import_ids select p_table,value->>'question_id',p_request_id from jsonb_array_elements(snapshots);
  if p_origin = 'recovery' then
    saved_result := public.admin_question_import_action(p_actor_id,p_table,p_request_id,'undo',true);
    update public.admin_question_import_batches set result = saved_result || jsonb_build_object('importBatchId',p_request_id) where id = p_request_id;
    return saved_result || jsonb_build_object('importBatchId',p_request_id);
  end if;
  return saved_result;
end $$;

