-- The question saves, review markers, counter increments and retry receipt
-- commit together. No successful write can lose its count or count twice.
create or replace function public.apply_admin_question_updates(
  p_request_id uuid, p_fingerprint text, p_actor_id uuid, p_table text,
  p_topic_scoped boolean, p_topic text, p_writes jsonb,
  p_reviewed_ids text[], p_response jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_existing public.admin_question_update_batches%rowtype;
  v_write jsonb;
  v_id text;
  v_topic text;
  v_after_topic text;
  v_set text;
  v_count integer;
  v_written integer := 0;
  v_topics jsonb := '{}'::jsonb;
  v_entry record;
  v_result jsonb;
begin
  if not exists(select 1 from public.users where id = p_actor_id and role = 'admin') then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if p_table is null or not p_table = any(array[
    'english_subject_questions','telugu_subject_questions','math_english_medium',
    'telugu_medium_math','english_medium_science','telugu_medium_science',
    'socal_english_medium','socal_telugu_medimum','pedagogy_english_medium',
    'pedagogy_subject_questions','gk_english_medium','gk_telugu_medium',
    'dsc_practice_questions','mathematics_subject_questions','social_subject_questions'
  ]) then raise exception 'Invalid question table' using errcode = '22023'; end if;
  if jsonb_typeof(p_writes) is distinct from 'array' then
    raise exception 'Invalid writes' using errcode = '22023';
  end if;
  if jsonb_array_length(p_writes) not between 0 and 500 or
    coalesce(cardinality(p_reviewed_ids), 0) not between 1 and 500 or
    p_topic_scoped is null or jsonb_typeof(p_response) is distinct from 'object' then
    raise exception 'Invalid batch size' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_existing from public.admin_question_update_batches where request_id = p_request_id;
  if found then
    if v_existing.fingerprint <> p_fingerprint or v_existing.actor_id is distinct from p_actor_id then
      raise exception 'Request ID already used for another batch' using errcode = '22023';
    end if;
    return v_existing.result;
  end if;
  -- Lock the entire reviewed set in one deterministic order, including rows
  -- whose wording is unchanged, to avoid overlapping-batch deadlocks.
  for v_id in select distinct unnest(p_reviewed_ids) order by 1 loop
    execute format('select topic from public.%I where question_id = $1 for update', p_table) into v_topic using v_id;
    get diagnostics v_count = row_count;
    if v_count <> 1 or (p_topic_scoped and v_topic is distinct from p_topic) then
      raise exception 'Question removed or moved to another topic; reload the batch' using errcode = '40001';
    end if;
  end loop;
  for v_write in select value from jsonb_array_elements(p_writes) order by value->>'id' loop
    v_id := v_write->>'id';
    if v_id is null or not v_id = any(p_reviewed_ids) or jsonb_typeof(v_write->'update') is distinct from 'object' then
      raise exception 'Invalid question update' using errcode = '22023';
    end if;
    if exists(select 1 from jsonb_each(v_write->'update') where
      not key = any(array['question','option_a','option_b','option_c','option_d','correct_answer','explanation','topic','subtopic','chapter','difficulty'])
      or jsonb_typeof(value) <> 'string') then
      raise exception 'Invalid editable column' using errcode = '22023';
    end if;
    execute format('select topic from public.%I where question_id = $1 for update', p_table) into v_topic using v_id;
    get diagnostics v_count = row_count;
    if v_count <> 1 or (p_topic_scoped and v_topic is distinct from p_topic) then
      raise exception 'Question removed or moved to another topic; reload the batch' using errcode = '40001';
    end if;
    select string_agg(format('%I = %L', key, value), ', ') into v_set from jsonb_each_text(v_write->'update');
    if v_set is null then raise exception 'Empty update' using errcode = '22023'; end if;
    execute format('update public.%I set %s where question_id = $1 returning topic', p_table, v_set) into v_after_topic using v_id;
    get diagnostics v_count = row_count;
    if v_count <> 1 then raise exception 'Question update failed' using errcode = '40001'; end if;
    v_written := v_written + 1;
    v_topics := v_topics || jsonb_build_object(coalesce(to_jsonb(v_topic)::text, 'null'), v_topic)
      || jsonb_build_object(coalesce(to_jsonb(v_after_topic)::text, 'null'), v_after_topic);
  end loop;
  for v_id in select distinct unnest(p_reviewed_ids) order by 1 loop
    execute format('select topic from public.%I where question_id = $1 for update', p_table) into v_topic using v_id;
    get diagnostics v_count = row_count;
    if v_count <> 1 then raise exception 'Reviewed question no longer exists' using errcode = '40001'; end if;
    insert into public.admin_question_reviews(question_table, question_id, topic_key, reviewed_by)
      values(p_table, v_id, coalesce(to_jsonb(v_topic)::text, 'null'), p_actor_id)
      on conflict(question_table, question_id) do update set
        topic_key = excluded.topic_key, reviewed_at = now(), reviewed_by = excluded.reviewed_by;
  end loop;
  for v_entry in select key, value from jsonb_each(v_topics) order by key loop
    insert into public.admin_question_topic_updates(question_table, topic_key, topic, update_count, updated_by)
      values(p_table, v_entry.key, v_entry.value #>> '{}', 1, p_actor_id)
      on conflict(question_table, topic_key) do update set
        update_count = public.admin_question_topic_updates.update_count + 1,
        last_updated_at = now(), updated_by = excluded.updated_by;
  end loop;
  v_result := jsonb_set(p_response, '{summary,written}', to_jsonb(v_written), true);
  insert into public.admin_question_update_batches(request_id, fingerprint, actor_id, result)
    values(p_request_id, p_fingerprint, p_actor_id, v_result);
  return v_result;
end;
$$;
revoke all on function public.apply_admin_question_updates(uuid,text,uuid,text,boolean,text,jsonb,text[],jsonb) from public, anon, authenticated;
grant execute on function public.apply_admin_question_updates(uuid,text,uuid,text,boolean,text,jsonb,text[],jsonb) to service_role;
notify pgrst, 'reload schema';
