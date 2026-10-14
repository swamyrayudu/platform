-- Run via Supabase execute_sql. Every fixture and mutation is rolled back.
begin;
do $$
declare
  a uuid; batch uuid := gen_random_uuid(); legacy uuid := gen_random_uuid(); failed uuid := gen_random_uuid();
  qid text := 'UNDO-TEST-' || gen_random_uuid(); legacy_id text := 'LEGACY-TEST-' || gen_random_uuid();
  r jsonb; original jsonb; response jsonb; snapshots jsonb;
begin
  select id into a from public.users where role = 'admin' order by created_at limit 1;
  if a is null then raise exception 'Admin fixture required'; end if;
  r := jsonb_build_array(jsonb_build_object('question_id', qid, 'question', 'Undo test ' || qid,
    'option_a','One','option_b','Two','option_c','Three','option_d','Four','correct_answer','A','topic','Undo test'));
  response := public.capture_admin_question_import(batch,'test',a,'english_medium_science',r,'{"success":true}'::jsonb,'import');
  if response->>'importBatchId' <> batch::text then raise exception 'Missing receipt'; end if;
  perform public.capture_admin_question_import(batch,'test',a,'english_medium_science',r,'{}','import');
  if (select count(*) from public.english_medium_science where question_id = qid) <> 1 then raise exception 'Retry duplicated an import'; end if;
  select rows into original from public.admin_question_import_batches where id = batch;
  response := public.admin_question_import_action(a,'english_medium_science',batch,'undo',false);
  if (response->>'eligible')::boolean is not true or not exists(select 1 from public.english_medium_science where question_id=qid) then raise exception 'Invalid preview or preview wrote'; end if;
  insert into public.question_usage(user_id,question_id) values(a,'english_medium_science:'||qid);
  begin
    perform public.admin_question_import_action(a,'english_medium_science',batch,'undo',true);
    raise exception 'Usage guard did not reject Undo';
  exception when serialization_failure then null; end;
  if not exists(select 1 from public.english_medium_science where question_id=qid) then raise exception 'Usage guard removed a question'; end if;
  delete from public.question_usage where user_id=a and question_id='english_medium_science:'||qid;
  perform public.admin_question_import_action(a,'english_medium_science',batch,'undo',true);
  perform public.admin_question_import_action(a,'english_medium_science',batch,'undo',true);
  if exists(select 1 from public.english_medium_science where question_id=qid) then raise exception 'Undo failed'; end if;
  if not exists(select 1 from public.admin_question_import_ids where question_table='english_medium_science' and question_id=qid) then raise exception 'Undo failed to reserve ID'; end if;
  insert into public.english_medium_science(question_id,question,option_a,option_b,option_c,option_d,correct_answer)
    values('DUP-'||qid,'Undo test '||qid,'One','Two','Three','Four','A');
  begin
    perform public.admin_question_import_action(a,'english_medium_science',batch,'restore',true);
    raise exception 'Restore duplicated an existing question';
  exception when serialization_failure then null; end;
  delete from public.english_medium_science where question_id='DUP-'||qid;
  perform public.admin_question_import_action(a,'english_medium_science',batch,'restore',true);
  perform public.admin_question_import_action(a,'english_medium_science',batch,'restore',true);
  if not exists(select 1 from public.english_medium_science q where to_jsonb(q)=original->0) then raise exception 'Restore changed IDs, metadata or timestamps'; end if;
  update public.english_medium_science set question='Changed after import '||qid where question_id=qid;
  begin
    perform public.admin_question_import_action(a,'english_medium_science',batch,'undo',true);
    raise exception 'Undo overwrote a later change';
  exception when serialization_failure then null; end;
  insert into public.english_medium_science(question_id,question,option_a,option_b,option_c,option_d,correct_answer,topic)
    values(legacy_id,'Legacy test '||legacy_id,'One','Two','Three','Four','A','Wrong topic');
  select jsonb_build_array(to_jsonb(q)) into snapshots from public.english_medium_science q where question_id=legacy_id;
  response := public.capture_admin_question_import(legacy,'recovery-test',a,'english_medium_science',snapshots,'{}','recovery');
  if response->>'status' <> 'undone' or exists(select 1 from public.english_medium_science where question_id=legacy_id) then raise exception 'Legacy recovery failed'; end if;
  perform public.capture_admin_question_import(legacy,'recovery-test',a,'english_medium_science',snapshots,'{}','recovery');
  perform public.admin_question_import_action(a,'english_medium_science',legacy,'restore',true);
  if not exists(select 1 from public.english_medium_science q where to_jsonb(q)=snapshots->0) then raise exception 'Legacy Restore changed original snapshot'; end if;
  r := jsonb_build_array(jsonb_build_object('question_id','ATOMIC-'||failed,'question','Atomic test '||failed,
    'option_a','One','option_b','Two','option_c','Three','option_d','Four','correct_answer','A'));
  r := r || jsonb_build_array((r->0) || jsonb_build_object('question_id','ATOMIC-SECOND-'||failed));
  begin
    perform public.capture_admin_question_import(failed,'atomic-test',a,'english_medium_science',r,'{}','import');
    raise exception 'Expected duplicate text rejection';
  exception when unique_violation then null; end;
  if exists(select 1 from public.english_medium_science where question_id='ATOMIC-'||failed)
    or exists(select 1 from public.admin_question_import_batches where id=failed)
    or exists(select 1 from public.admin_question_import_ids where batch_id=failed) then raise exception 'Failed import left partial data'; end if;
  if has_function_privilege('anon','public.admin_question_import_action(uuid,text,uuid,text,boolean,jsonb)','execute')
    or has_function_privilege('authenticated','public.capture_admin_question_import(uuid,text,uuid,text,jsonb,jsonb,text)','execute') then raise exception 'Public role can mutate imports'; end if;
end $$;
select 'Import, retry, preview, Undo, Restore, usage, changed row, legacy recovery, atomicity and permissions passed' as result;
rollback;
