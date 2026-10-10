import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import { mockLibraryOptions, mergeMockPages } from '../utils/mock-pagination';
import { selectReviewQuestions, type ReviewQuestion } from '../utils/question-review';
import type { MockTestListItem, MockTestListResponse } from '../types/mock-tests';

function paper(id:string, progress:MockTestListItem['progress_status']='not_started'):MockTestListItem {
  return {id,slug:id,title:id,description:null,category:'grand_mock',medium:'english',duration_minutes:150,total_questions:160,total_marks:80,is_free:true,status:'published',published_at:null,module_number:null,series:'grand_mock_v1',version:1,progress_status:progress,is_sequence_locked:false};
}
function page(number:number,tests:MockTestListItem[],totalPages=2):MockTestListResponse {
  return {success:true,medium:'english',tests,page:number,page_size:20,total:3,total_pages:totalPages,medium_counts:{english:3,telugu:1},highest_completed_module:0};
}
const filters={medium:'english',category:'grand_mock',search:''};

test('mock scrolling retains loaded papers on failure, retries the same page and stops at the last page',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
  const calls:number[]=[];let failNext=true;
  const options=mockLibraryOptions(filters,async({page:number})=>{
    calls.push(number);
    if(number===1)return page(1,[paper('one'),paper('two')]);
    if(failNext){failNext=false;throw new Error('Connection lost');}
    return page(2,[paper('two','completed'),paper('three')]);
  });
  const observer=new InfiniteQueryObserver(client,options);
  const unsubscribe=observer.subscribe(()=>{});
  try {
    await observer.refetch();
    await observer.fetchNextPage({cancelRefetch:false});
    assert.equal(observer.getCurrentResult().isFetchNextPageError,true);
    assert.deepEqual(mergeMockPages(observer.getCurrentResult().data!.pages).map(row=>row.id),['one','two']);
    await observer.fetchNextPage({cancelRefetch:false});
    const result=observer.getCurrentResult();
    assert.equal(result.isFetchNextPageError,false);
    assert.equal(result.hasNextPage,false);
    const rows=mergeMockPages(result.data!.pages);
    assert.deepEqual(rows.map(row=>row.id),['one','two','three']);
    assert.equal(rows[1].progress_status,'completed');
    await observer.fetchNextPage({cancelRefetch:false});
    assert.deepEqual(calls,[1,2,2]);
  } finally {unsubscribe();client.clear();}
});

test('changing medium, category or search starts a separate feed, and repeated scroll events share a request',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
  let pageTwoCalls=0;let release:()=>void=()=>{};
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const load=async(params:typeof filters & {page:number})=>{
    if(params.page===2){pageTwoCalls++;await gate;}
    return page(params.page,[paper(`${params.medium}:${params.category}:${params.search}:${params.page}`)]);
  };
  const observer=new InfiniteQueryObserver(client,mockLibraryOptions(filters,load));
  const unsubscribe=observer.subscribe(()=>{});
  try {
    await observer.refetch();
    const first=observer.fetchNextPage({cancelRefetch:false});
    const duplicate=observer.fetchNextPage({cancelRefetch:false});
    release();await Promise.all([first,duplicate]);
    assert.equal(pageTwoCalls,1);
    for(const changed of [{...filters,medium:'telugu'},{...filters,category:'subject_mock'},{...filters,search:'science'}]){
      observer.setOptions(mockLibraryOptions(changed,load));
      await observer.refetch();
      const data=observer.getCurrentResult().data!;
      assert.deepEqual(data.pageParams,[1]);
      assert.deepEqual(mergeMockPages(data.pages).map(row=>row.id),[`${changed.medium}:${changed.category}:${changed.search}:1`]);
    }
  } finally {unsubscribe();client.clear();}
});

test('answer filters preserve paper numbering, source identity and explanations without treating skipped answers as incorrect',()=>{
  const base:ReviewQuestion={question_id:'Q1',question:'Pick a letter',option_a:'A',option_b:'B',option_c:'C',option_d:'D',user_answer:'B',correct_answer:'A',explanation:'The concept behind A',is_correct:false,is_skipped:false,is_marked:false};
  const questions=[{...base,question_uid:'english:Q1',question_number:4},{...base,question_uid:'math:Q1',question_number:8,user_answer:null,is_skipped:true},{...base,question_id:'Q3',is_correct:true,user_answer:'A',is_marked:true}];
  const all=selectReviewQuestions(questions,'all');
  assert.equal(new Set(all.map(row=>row.key)).size,3);
  assert.deepEqual(selectReviewQuestions(questions,'incorrect').map(row=>row.number),[4]);
  assert.deepEqual(selectReviewQuestions(questions,'skipped').map(row=>row.number),[8]);
  assert.deepEqual(selectReviewQuestions(questions,'marked').map(row=>row.number),[3]);
  assert.equal(selectReviewQuestions(questions,'incorrect')[0].question.explanation,base.explanation);
});
