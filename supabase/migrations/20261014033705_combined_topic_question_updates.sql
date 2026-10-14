-- Hold the original question/topic scope while the existing atomic save runs.
-- The original RPC remains compatible with single-topic and whole-table clients.
create function public.apply_admin_combined_topic_updates(
  p_request_id uuid, p_fingerprint text, p_actor_id uuid, p_table text,
  p_writes jsonb, p_reviewed_ids text[], p_response jsonb, p_expected_topics jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_id text;
  v_topic text;
  v_count integer;
begin
  if not exists(select 1 from public.users where id=p_actor_id and role='admin') then
    raise exception 'Admin required' using errcode='42501';
  end if;
  if p_table is null or not p_table=any(array[
    'english_subject_questions','telugu_subject_questions','math_english_medium',
    'telugu_medium_math','english_medium_science','telugu_medium_science',
    'socal_english_medium','socal_telugu_medimum','pedagogy_english_medium',
    'pedagogy_subject_questions','gk_english_medium','gk_telugu_medium',
    'dsc_practice_questions','mathematics_subject_questions','social_subject_questions'
  ]) then raise exception 'Invalid question table' using errcode='22023'; end if;
  if jsonb_typeof(p_expected_topics) is distinct from 'object' or
    jsonb_typeof(p_writes) is distinct from 'array' then
    raise exception 'Invalid combined batch' using errcode='22023';
  end if;
  if (select count(*) from jsonb_each(p_expected_topics)) not between 2 and 100 or
    (select count(distinct value) from jsonb_each(p_expected_topics)) not between 2 and 5 or
    exists(select 1 from jsonb_each(p_expected_topics) where jsonb_typeof(value) not in ('string','null')) or
    jsonb_array_length(p_writes)>100 or coalesce(cardinality(p_reviewed_ids),0) not between 1 and 100 then
    raise exception 'Combine 2-5 topics with at most 100 questions' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  -- A concurrent retry may reach the function after the first save reclassified rows.
  if exists(select 1 from public.admin_question_update_batches where request_id=p_request_id) then
    return public.apply_admin_question_updates(p_request_id,p_fingerprint,p_actor_id,p_table,
      false,null,p_writes,p_reviewed_ids,p_response);
  end if;
  for v_id in select distinct unnest(p_reviewed_ids) order by 1 loop
    if not p_expected_topics ? v_id then raise exception 'Missing original topic' using errcode='22023'; end if;
    execute format('select topic from public.%I where question_id=$1 for update',p_table) into v_topic using v_id;
    get diagnostics v_count=row_count;
    if v_count<>1 or coalesce(to_jsonb(v_topic),'null'::jsonb) is distinct from p_expected_topics->v_id then
      raise exception 'Question removed or moved; reload the combined batch' using errcode='40001';
    end if;
  end loop;
  return public.apply_admin_question_updates(p_request_id,p_fingerprint,p_actor_id,p_table,
    false,null,p_writes,p_reviewed_ids,p_response);
end;
$$;
revoke all on function public.apply_admin_combined_topic_updates(uuid,text,uuid,text,jsonb,text[],jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_admin_combined_topic_updates(uuid,text,uuid,text,jsonb,text[],jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
