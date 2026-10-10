import { useEffect, useMemo, useState } from 'react';
import { ListScreen, Card, Body, Button, Chips, Input, Loading, ErrorState, EmptyState, Badge } from '@/components/ui';
import { MockPaperCard } from '@/components/mock-paper-card';
import { useMockLibrary } from '@/hooks/use-mock-library';
import { mergeMockPages } from '@/utils/mock-pagination';
import { useAuth } from '@/store/auth';
import type { EducationMedium } from '@/types/auth';
export default function Mocks() {
  const {user}=useAuth();
  const [medium,setMedium]=useState<EducationMedium>(user?.educationMedium||'english');
  const [category,setCategory]=useState(''); const [search,setSearch]=useState(''); const [term,setTerm]=useState('');
  useEffect(()=>{const timer=setTimeout(()=>setTerm(search.trim()),350);return()=>clearTimeout(timer);},[search]);
  const tests=useMockLibrary({medium,category,search:term});
  const papers=useMemo(()=>mergeMockPages(tests.data?.pages ?? []),[tests.data]);
  const first=tests.data?.pages[0];
  const loadMore=()=>{if(tests.hasNextPage&&!tests.isFetching&&!tests.isFetchNextPageError)void tests.fetchNextPage({cancelRefetch:false});};
  return <ListScreen key={`${medium}:${category}:${term}`} title="Mock test library" subtitle="Full-length papers. One module at a time."
    data={papers} keyExtractor={test=>test.id} renderItem={({item})=><MockPaperCard test={item}/>} onEndReached={loadMore}
    refreshing={tests.isRefetching&&!tests.isFetchingNextPage} onRefresh={()=>void tests.refetch()}
    header={<>
      <Card><Chips items={[{value:'english',label:'English'},{value:'telugu',label:'తెలుగు'}]} selected={medium} onSelect={setMedium}/>
        <Input label="Find a paper" placeholder="Search mock tests…" value={search} onChangeText={setSearch}/>
        <Chips items={[{value:'',label:'All papers'},{value:'grand_mock',label:'Grand mocks'},{value:'subject_mock',label:'Subject mocks'},{value:'previous_paper',label:'Previous papers'}]} selected={category} onSelect={setCategory}/>
      </Card>
      {first ? <><Badge label={`${first.total} papers · ${medium==='telugu'?'తెలుగు':'English'}`}/><Body>{first.highest_completed_module} modules completed in your learning journey.</Body></> : null}
      {tests.error&&!tests.isFetchNextPageError ? <ErrorState error={tests.error} retry={()=>void tests.refetch()}/> : null}
    </>}
    empty={tests.isPending ? <Loading/> : !tests.error ? <EmptyState title="No papers found" detail="Try another title, category or study medium." icon="search-outline"/> : undefined}
    footer={<>
      {tests.isFetchingNextPage ? <Loading/> : tests.isFetchNextPageError ? <ErrorState error={tests.error} retry={()=>void tests.fetchNextPage({cancelRefetch:false})}/> : tests.hasNextPage ? <Button secondary label="Load more papers" onPress={loadMore}/> : papers.length ? <Body>All caught up · {papers.length} papers</Body> : null}
    </>}/>;
}
