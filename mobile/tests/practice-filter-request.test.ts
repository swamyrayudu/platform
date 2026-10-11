import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { practiceFilterRequest, samePracticeCatalog } from '../utils/practice-filter-request';
import type { PracticeFilterState } from '../types/practice';

const filter:PracticeFilterState={medium:'english',subject:'English',class_levels:['Class 5','Class 3'],topics:['Nouns','Grammar'],subtopics:[],difficulty:['Medium','Easy'],question_count:25,mode:'balanced',feedback_mode:'instant',has_timer:false,duration_minutes:30};
test('count, timer, feedback and mode changes reuse metadata; equivalent multi-select order shares one cached request',async()=>{
  const client=new QueryClient();let calls=0;
  const read=async(selection:PracticeFilterState)=>client.fetchQuery({queryKey:['practice-filters',practiceFilterRequest(selection)],staleTime:120000,queryFn:async()=>{calls++;return {total_matching_questions:100};}});
  await read(filter);
  const changed={...filter,question_count:50,mode:'random' as const,has_timer:true,duration_minutes:15,feedback_mode:'end' as const,class_levels:[...filter.class_levels].reverse(),topics:[...filter.topics].reverse(),difficulty:[...filter.difficulty].reverse()};
  assert.equal((await read(changed)).total_matching_questions,100);
  assert.equal(calls,1);
  assert.deepEqual(filter.class_levels,['Class 5','Class 3']);
  client.clear();
});
test('subject, medium and class changes cannot keep the previous topic catalog',()=>{
  const current=practiceFilterRequest(filter);
  for(const changed of [{subject:'Science'},{medium:'telugu' as const},{class_levels:['Class 10']}])assert.equal(samePracticeCatalog(current,practiceFilterRequest({...filter,...changed})),false);
  assert.equal(samePracticeCatalog(current,practiceFilterRequest({...filter,topics:['Grammar'],subtopics:['Verbs'],difficulty:['Hard']})),true);
});
test('changed topic or difficulty keeps its own confirmed count instead of reusing the previous filter count',async()=>{
  const client=new QueryClient();let calls=0;
  const cases:[PracticeFilterState,number][]=[[filter,100],[{...filter,topics:['Grammar']},30],[{...filter,difficulty:['Hard']},12]];
  for(const [selection,count] of cases){
    const request=practiceFilterRequest(selection);
    const data=await client.fetchQuery({queryKey:['practice-filters',request],staleTime:120000,queryFn:async()=>{calls++;return {total_matching_questions:count};}});
    assert.equal(data.total_matching_questions,count);
  }
  assert.equal(calls,3);
  client.clear();
});
