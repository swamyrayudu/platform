import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { ListScreen, Body, Button, Chips, Loading, ErrorState, EmptyState } from '@/components/ui';
import { MockPaperCard } from '@/components/mock-paper-card';
import { StudentHeader } from '@/components/student-header';
import { useMockLibrary } from '@/hooks/use-mock-library';
import { mergeMockPages } from '@/utils/mock-pagination';
import { useAuth } from '@/store/auth';
import type { EducationMedium } from '@/types/auth';
import { colors } from '@/utils/theme';
import { practiceService } from '@/services/question-service';
export default function Mocks() {
  const {user}=useAuth();
  const [medium,setMedium]=useState<EducationMedium>(user?.educationMedium||'english');
  const [category,setCategory]=useState(''); const [search,setSearch]=useState(''); const [term,setTerm]=useState('');
  const [filtersOpen,setFiltersOpen]=useState(false);
  useEffect(()=>{const timer=setTimeout(()=>setTerm(search.trim()),350);return()=>clearTimeout(timer);},[search]);
  const tests=useMockLibrary({medium,category,search:term});
  const papers=useMemo(()=>mergeMockPages(tests.data?.pages ?? []),[tests.data]);
  const first=tests.data?.pages[0];
  const sample=first?.tests[0];
  const quota=useQuery({queryKey:['quota'],queryFn:practiceService.quota});
  const loadMore=()=>{if(tests.hasNextPage&&!tests.isFetching&&!tests.isFetchNextPageError)void tests.fetchNextPage({cancelRefetch:false});};
  return <ListScreen key={`${medium}:${category}:${term}`} title="SGT Mock Tests" topBar={<StudentHeader/>}
    pageHeader={<View style={{gap:5}}><View style={styles.titleRow}><View style={styles.titleMark}/><Text accessibilityRole="header" style={styles.title}>SGT Mock Tests</Text></View><Text style={styles.subtitle}>Predefined full-length exam modules{sample?` · ${sample.total_questions} Questions · ${sample.total_marks} Marks · ${sample.duration_minutes} Minutes`:''}</Text></View>}
    data={papers} keyExtractor={test=>test.id} renderItem={({item})=><MockPaperCard test={item} premium={quota.data?.isPremium}/>} onEndReached={loadMore}
    refreshing={tests.isRefetching&&!tests.isFetchingNextPage} onRefresh={()=>void tests.refetch()}
    header={<>
      <View style={styles.mediumOuter}><View style={styles.mediumInner}>{([{value:'telugu',label:'తెలుగు',icon:'language-outline'},{value:'english',label:'English',icon:'globe-outline'}] as const).map(item=>{const selected=medium===item.value;const foreground=selected?'#fff':colors.muted;return <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={`${item.label} medium`} accessibilityState={{selected}} onPress={()=>setMedium(item.value)} style={[styles.mediumTab,selected&&{backgroundColor:item.value==='telugu'?'#33948B':colors.primary}]}><Ionicons name={item.icon} size={16} color={foreground}/><Text style={[styles.mediumText,{color:foreground}]}>{item.label}</Text><View style={[styles.count,selected&&{backgroundColor:'#FFFFFF30'}]}><Text style={[styles.countText,{color:foreground}]}>{first?.medium_counts[item.value]??'…'}</Text></View></Pressable>;})}</View></View>
      <View style={styles.search}><Ionicons name="search-outline" size={18} color={colors.muted}/><TextInput accessibilityLabel="Search module name" value={search} onChangeText={setSearch} placeholder="Search module name…" placeholderTextColor={colors.muted} style={styles.searchInput} autoCapitalize="none"/><Pressable accessibilityRole="button" accessibilityLabel="Filter papers by category" accessibilityState={{expanded:filtersOpen}} onPress={()=>setFiltersOpen(value=>!value)} style={styles.filterButton}><Ionicons name="options-outline" size={18} color={category?colors.primary:colors.muted}/></Pressable></View>
      {filtersOpen ? <Chips items={[{value:'',label:'All papers'},{value:'grand_mock',label:'Grand mocks'},{value:'subject_mock',label:'Subject mocks'},{value:'previous_paper',label:'Previous papers'}]} selected={category} onSelect={setCategory}/> : null}
      {first&&papers.some(paper=>paper.is_sequence_locked) ? <View style={styles.notice}><Ionicons name="list-outline" size={17} color={colors.primary}/><Text style={styles.noticeText}><Text style={{fontWeight:'600'}}>Modules unlock one at a time — Module {String(first.highest_completed_module+1).padStart(2,'0')} is next.</Text>{' '}Submit it to open Module {String(first.highest_completed_module+2).padStart(2,'0')}, and so on through the series.</Text></View> : null}
      {quota.error ? <ErrorState error={quota.error} retry={()=>void quota.refetch()}/> : null}
      {tests.error&&!tests.isFetchNextPageError ? <ErrorState error={tests.error} retry={()=>void tests.refetch()}/> : null}
    </>}
    empty={tests.isPending ? <Loading/> : !tests.error ? <EmptyState title="No papers found" detail="Try another title, category or study medium." icon="search-outline"/> : undefined}
    footer={<>
      {tests.isFetchingNextPage ? <Loading/> : tests.isFetchNextPageError ? <ErrorState error={tests.error} retry={()=>void tests.fetchNextPage({cancelRefetch:false})}/> : tests.hasNextPage ? <Button secondary label="Load more papers" onPress={loadMore}/> : papers.length ? <Body>All caught up · {papers.length} papers</Body> : null}
    </>}/>;
}
const styles=StyleSheet.create({
  titleRow:{flexDirection:'row',alignItems:'center',gap:8},titleMark:{width:3,height:20,borderRadius:2,backgroundColor:colors.primary},title:{fontSize:20,lineHeight:27,fontWeight:'700',color:colors.ink},subtitle:{fontSize:12,lineHeight:19,color:colors.muted},mediumOuter:{borderRadius:28,borderWidth:1,borderColor:colors.border,padding:7,backgroundColor:'#FCFBFA'},mediumInner:{flexDirection:'row',gap:4,borderRadius:24,borderWidth:1,borderColor:colors.border,padding:4,backgroundColor:'#F6F5F2'},mediumTab:{flex:1,minHeight:44,flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:6,paddingVertical:7,borderRadius:22},mediumText:{fontSize:12,fontWeight:'600'},count:{borderRadius:12,backgroundColor:colors.border,paddingHorizontal:5,paddingVertical:1},countText:{fontSize:10,fontWeight:'600'},search:{flexDirection:'row',alignItems:'center',gap:8,minHeight:44,paddingLeft:13,borderRadius:22,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card},searchInput:{flex:1,fontSize:12,color:colors.ink,minHeight:44,paddingVertical:8},filterButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},notice:{flexDirection:'row',alignItems:'flex-start',gap:10,padding:16,borderRadius:22,borderWidth:1,borderColor:'#BEB8D9',backgroundColor:colors.primarySoft},noticeText:{flex:1,fontSize:12,lineHeight:21,color:colors.primary},
});
