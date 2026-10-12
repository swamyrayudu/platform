import { Heading } from '@/components/heading';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type ListRenderItemInfo } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { ListScreen, Chips, Loading, ErrorState, EmptyState } from '@/components/ui';
import { MockPaperCard } from '@/components/mock-paper-card';
import { useMockLibrary } from '@/hooks/use-mock-library';
import { mergeMockPages, MOCK_PAGE_SIZE } from '@/utils/mock-pagination';
import { useAuth } from '@/store/auth';
import type { EducationMedium } from '@/types/auth';
import type { MockTestListItem } from '@/types/mock-tests';
import { colors } from '@/utils/theme';
import { practiceService } from '@/services/question-service';

const paperKey=(test:MockTestListItem)=>test.id;
const mediums=[
  {value:'telugu',label:'తెలుగు',icon:'language-outline'},
  {value:'english',label:'English',icon:'globe-outline'},
] as const;

export default function Mocks() {
  const {user}=useAuth();
  const [medium,setMedium]=useState<EducationMedium>(user?.educationMedium||'english');
  const [category,setCategory]=useState(''); const [search,setSearch]=useState(''); const [term,setTerm]=useState('');
  const [filtersOpen,setFiltersOpen]=useState(false);
  useEffect(()=>{const timer=setTimeout(()=>setTerm(search.trim()),350);return()=>clearTimeout(timer);},[search]);
  const tests=useMockLibrary({medium,category,search:term});
  const pages=tests.data?.pages;
  const papers=useMemo(()=>mergeMockPages(pages ?? []),[pages]);
  const first=tests.data?.pages[0];
  const sample=first?.tests[0];
  const quota=useQuery({queryKey:['quota'],queryFn:practiceService.quota});
  const {hasNextPage,isFetching,isFetchNextPageError,fetchNextPage,error:testsError,refetch}=tests;
  const {error:quotaError,refetch:refreshQuota}=quota;
  const loadMore=useCallback(()=>{
    if(hasNextPage&&!isFetching&&!isFetchNextPageError)
      void fetchNextPage({cancelRefetch:false});
  },[hasNextPage,isFetching,isFetchNextPageError,fetchNextPage]);
  const premium=quota.data?.isPremium;
  const renderPaper=useCallback(({item}:ListRenderItemInfo<MockTestListItem>)=>
    <MockPaperCard test={item} premium={premium}/>,[premium]);
  const refresh=useCallback(()=>void refetch(),[refetch]);
  const sequenceLocked=useMemo(()=>papers.some(paper=>paper.is_sequence_locked),[papers]);
  const pageHeader=useMemo(()=><View style={styles.heading}>
      <View style={styles.titleRow}><View style={styles.titleMark}/><Heading style={styles.title}>SGT Mock Tests</Heading></View>
      {sample ? <Text style={styles.subtitle}>{sample.total_questions} questions · {sample.total_marks} marks · {sample.duration_minutes} min</Text> : null}
    </View>,[sample]);
  // Page fetch notifications should not rebuild medium tabs, search and filters.
  const header=useMemo(()=><>
      <View style={styles.mediumTabs}>{mediums.map(item=>{
        const selected=medium===item.value;
        const foreground=selected?'#fff':colors.muted;
        return <Pressable key={item.value} accessibilityRole="button"
          accessibilityLabel={`${item.label} medium`} accessibilityState={{selected}}
          onPress={()=>setMedium(item.value)}
          style={({pressed})=>[styles.mediumTab,selected&&{backgroundColor:item.value==='telugu'?'#33948B':colors.primary},pressed&&styles.pressed]}>
          <Ionicons name={item.icon} size={16} color={foreground}/>
          <Text style={[styles.mediumText,{color:foreground}]}>{item.label}</Text>
          <View style={[styles.count,selected&&styles.selectedCount]}>
            <Text style={[styles.countText,{color:foreground}]}>{first?.medium_counts[item.value]??'…'}</Text>
          </View>
        </Pressable>;
      })}</View>
      <View style={styles.search}>
        <Ionicons name="search-outline" size={18} color={colors.muted}/>
        <TextInput accessibilityLabel="Search module name" value={search} onChangeText={setSearch}
          placeholder="Search modules…" placeholderTextColor={colors.muted} style={styles.searchInput} autoCapitalize="none"/>
        <Pressable accessibilityRole="button" accessibilityLabel="Filter papers by category"
          accessibilityState={{expanded:filtersOpen}} onPress={()=>setFiltersOpen(value=>!value)}
          style={({pressed})=>[styles.filterButton,pressed&&styles.pressed]}>
          <Ionicons name="options-outline" size={20} color={category?colors.primary:colors.muted}/>
        </Pressable>
      </View>
      {filtersOpen ? <Chips items={[{value:'',label:'All papers'},{value:'grand_mock',label:'Grand mocks'},{value:'subject_mock',label:'Subject mocks'},{value:'previous_paper',label:'Previous papers'}]} selected={category} onSelect={setCategory}/> : null}
      {first&&sequenceLocked ? <View style={styles.notice}>
        <Ionicons name="list-outline" size={18} color={colors.primary}/>
        <Text style={styles.noticeText}>Complete Module {String(first.highest_completed_module+1).padStart(2,'0')} to unlock the next.</Text>
      </View> : null}
      {quotaError ? <ErrorState error={quotaError} retry={()=>void refreshQuota()}/> : null}
      {testsError&&!isFetchNextPageError ? <ErrorState error={testsError} retry={refresh}/> : null}
    </>,[medium,first,search,filtersOpen,category,sequenceLocked,quotaError,refreshQuota,testsError,isFetchNextPageError,refresh]);
  return <ListScreen key={`${medium}:${category}:${term}`} title="SGT Mock Tests"
    pageHeader={pageHeader} header={header}
    data={papers} keyExtractor={paperKey} renderItem={renderPaper} onEndReached={loadMore}
    initialNumToRender={MOCK_PAGE_SIZE} batchSize={2} updateCellsBatchingPeriod={32}
    windowSize={7} removeClippedSubviews={Platform.OS==='android'} onEndReachedThreshold={1.2}
    refreshing={tests.isRefetching&&!tests.isFetchingNextPage} onRefresh={refresh}
    empty={tests.isPending ? <Loading/> : !tests.error ? <EmptyState title="No papers found" detail="Try another title, category or study medium." icon="search-outline"/> : undefined}
    footer={papers.length ? <View style={styles.feedFooter}>
      {tests.isFetchingNextPage ? <ActivityIndicator accessibilityLabel="Loading more modules" color={colors.primary}/> :
        tests.isFetchNextPageError ? <ErrorState error={tests.error} retry={()=>void tests.fetchNextPage({cancelRefetch:false})}/> :
        !tests.hasNextPage ? <Text style={styles.footerText}>{papers.length} modules</Text> : null}
    </View> : null}/>;
}
const styles=StyleSheet.create({
  heading:{gap:5},titleRow:{flexDirection:'row',alignItems:'center',gap:8},
  titleMark:{width:3,height:20,borderRadius:2,backgroundColor:colors.primary},
  title:{flex:1},
  subtitle:{fontSize:12,lineHeight:19,color:colors.muted},
  mediumTabs:{flexDirection:'row',gap:4,borderRadius:18,borderWidth:1,borderColor:colors.border,padding:4,backgroundColor:colors.card},
  mediumTab:{flex:1,minHeight:44,flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:8,paddingVertical:8,borderRadius:14},
  mediumText:{fontSize:14,lineHeight:21,fontWeight:'600'},
  count:{borderRadius:9,backgroundColor:colors.border,paddingHorizontal:5,paddingVertical:1},
  selectedCount:{backgroundColor:'#FFFFFF30'},countText:{fontSize:11,lineHeight:17,fontWeight:'600'},
  search:{flexDirection:'row',alignItems:'center',gap:8,minHeight:48,paddingLeft:13,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card},
  searchInput:{flex:1,minWidth:0,fontSize:14,color:colors.ink,minHeight:48,paddingVertical:10},
  filterButton:{width:44,minHeight:48,alignItems:'center',justifyContent:'center'},pressed:{opacity:.7},
  notice:{flexDirection:'row',alignItems:'flex-start',gap:8,padding:12,borderRadius:14,backgroundColor:colors.primarySoft},
  noticeText:{flex:1,fontSize:12,lineHeight:19,color:colors.primary},
  feedFooter:{minHeight:48,justifyContent:'center'},footerText:{textAlign:'center',fontSize:12,lineHeight:19,color:colors.muted},
});
