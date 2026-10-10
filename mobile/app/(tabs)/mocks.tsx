import { useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, Card, Heading, Body, Button, Chips, Input, Loading, ErrorState } from '@/components/ui';
import { examService } from '@/services/exam-service';
import { useAuth } from '@/store/auth';
import type { EducationMedium } from '@/types/auth';
export default function Mocks() {
  const {user}=useAuth();const [medium,setMedium]=useState<EducationMedium>(user?.educationMedium||'english');const [category,setCategory]=useState('');const [search,setSearch]=useState('');const [term,setTerm]=useState('');const [page,setPage]=useState(1);
  const tests=useQuery({queryKey:['mocks',medium,category,term,page],queryFn:()=>examService.list({medium,category,search:term,page})});
  return <Screen title="Mock test library" subtitle="Practice the full paper. Build confidence for exam day." refreshing={tests.isRefetching} onRefresh={()=>void tests.refetch()}>
    <Chips items={[{value:'english',label:'English'},{value:'telugu',label:'తెలుగు'}]} selected={medium} onSelect={m=>{setMedium(m);setPage(1);}}/>
    <Chips items={[{value:'',label:'All papers'},{value:'grand_mock',label:'Grand mocks'},{value:'subject_mock',label:'Subject mocks'},{value:'previous_paper',label:'Previous papers'}]} selected={category} onSelect={c=>{setCategory(c);setPage(1);}}/>
    <Input label="Search paper titles" value={search} onChangeText={setSearch}/><Button secondary label="Search" onPress={()=>{setTerm(search.trim());setPage(1);}}/>
    {tests.isLoading&&<Loading/>}{tests.error&&<ErrorState error={tests.error} retry={()=>void tests.refetch()}/>}
    {tests.data&&<><Body>{tests.data.total} papers · {tests.data.highest_completed_module} highest completed module</Body>{tests.data.tests.length===0&&<Card><Body>No papers match your filters.</Body></Card>}{tests.data.tests.map(test=><Card key={test.id}><Heading>{test.title}</Heading><Body>{test.description}</Body><Body>{test.total_questions} questions · {test.duration_minutes} minutes · {test.total_marks} marks</Body><Body>{test.is_free?'Free paper':'Pro paper'} · {test.progress_status.replaceAll('_',' ')}</Body>{test.is_sequence_locked?<Body>Complete the preceding module to unlock this one.</Body>:<Button label={test.progress_status==='in_progress'?'Continue exam':test.progress_status==='completed'?'View results':'View instructions'} onPress={()=>test.user_attempt?.status==='submitted'?router.push({pathname:'/result',params:{kind:'mock',id:test.user_attempt.attempt_id}}):router.push({pathname:'/mock/[id]',params:{id:test.id}})}/>}</Card>)}<Body>Page {tests.data.page} of {Math.max(1,tests.data.total_pages)}</Body><Button secondary label="Previous page" disabled={page<=1} onPress={()=>setPage(x=>x-1)}/><Button secondary label="Next page" disabled={page>=tests.data.total_pages} onPress={()=>setPage(x=>x+1)}/></>}
  </Screen>;
}
