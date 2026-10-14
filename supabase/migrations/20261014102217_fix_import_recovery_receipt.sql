create or replace function public.capture_admin_question_import(
  p_request_id uuid, p_fingerprint text, p_actor_id uuid, p_table text,
  p_rows jsonb, p_result jsonb, p_origin text default 'import'
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  b public.admin_question_import_batches%rowtype;
  r jsonb; snapshot jsonb; snapshots jsonb := '[]'::jsonb; topics jsonb;
  columns_sql text; values_sql text; saved_result jsonb; duplicate boolean;
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

