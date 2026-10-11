import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { MockTestListItem } from '@/types/mock-tests';
import { colors } from '@/utils/theme';

export const MockPaperCard = memo(function MockPaperCard({test,premium}: {test:MockTestListItem;premium?:boolean}) {
  const completed = test.progress_status === 'completed';
  const ongoing = test.progress_status === 'in_progress';
  const proLocked=!test.is_free&&premium===false;
  const seriesLocked=!proLocked&&test.is_sequence_locked&&!completed;
  const percent=test.user_attempt?.percentage;
  const label=proLocked?'Unlock with Pro':seriesLocked?`Finish ${test.module_number!=null?`Module ${String(test.module_number-1).padStart(2,'0')}`:'the previous module'} first`:completed?'Results & analysis':ongoing?'Continue':'Start';
  const color=proLocked?colors.gold:seriesLocked?colors.muted:completed?'#32966B':colors.primary;
  function open() {
    if(proLocked){router.push('/subscription');return;}
    if(test.user_attempt?.status==='submitted')router.push({pathname:'/result',params:{kind:'mock',id:test.user_attempt.attempt_id}});
    else router.push({pathname:'/mock/[id]',params:{id:test.id}});
  }
  return <View style={[styles.card,completed&&{borderColor:'#A8DFCA'}]}>
    <View style={styles.badges}>
      <View style={styles.badgeGroup}>
        <View style={styles.module}><Text style={styles.moduleText}>{test.module_number!=null?`Module ${String(test.module_number).padStart(2,'0')}`:'Special Paper'}</Text></View>
        {test.medium==='bilingual' ? <View style={styles.medium}><Text style={styles.small}>Bilingual</Text></View> : null}
      </View>
      <View style={[styles.access,{borderColor:test.is_free?'#B5E5D0':'#EBCB94',backgroundColor:test.is_free?'#EFF9F4':'#FCF4E6'}]}>
        <Ionicons name={test.is_free?'checkmark-circle-outline':'ribbon-outline'} size={12} color={test.is_free?'#32966B':colors.gold}/>
        <Text style={[styles.small,{color:test.is_free?'#32966B':colors.gold}]}>{test.is_free?'Free':'Pro'}</Text>
      </View>
    </View>
    <Text accessibilityRole="header" style={styles.title}>{test.title}</Text>
    {completed||ongoing ? <View style={[styles.status,completed&&{borderColor:'#B5E5D0',backgroundColor:'#EFF9F4'}]}><Ionicons name={completed?'checkmark-circle-outline':'time-outline'} size={13} color={completed?'#32966B':colors.primary}/><Text style={[styles.statusText,completed&&{color:'#32966B'}]}>{completed?`Completed${percent!=null?` · ${percent.toFixed(1)}%`:''}`:'In progress'}</Text></View> : null}
    <View style={styles.stats}>{[{label:'Questions',value:test.total_questions},{label:'Marks',value:test.total_marks},{label:'Time',value:`${test.duration_minutes} min`}].map((stat,index)=><View key={stat.label} style={[styles.stat,index===1&&styles.middleStat]}><Text style={styles.statLabel}>{stat.label}</Text><Text style={styles.statValue}>{stat.value}</Text></View>)}</View>
    {completed&&test.user_attempt?.score!=null ? <View style={styles.score}><View style={styles.scoreLabel}><Ionicons name="trophy-outline" size={15} color="#32966B"/><Text style={styles.statLabel}>Best Score</Text></View><Text style={styles.scoreValue}>{test.user_attempt.score} / {test.total_marks}{percent!=null?` (${percent.toFixed(1)}%)`:''}</Text></View> : null}
    <View style={styles.actionWrap}><Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${test.title}`} accessibilityState={{disabled:seriesLocked}} disabled={seriesLocked} onPress={open} style={({pressed})=>[styles.action,{backgroundColor:proLocked?'#FCF4E6':seriesLocked?'#F4F3F1':color},pressed&&{opacity:.8}]}><Ionicons name={proLocked||seriesLocked?'lock-closed-outline':completed?'ribbon-outline':ongoing?'refresh-outline':'play-outline'} size={15} color={proLocked||seriesLocked?color:'#fff'}/><Text style={[styles.actionText,{color:proLocked||seriesLocked?color:'#fff'}]}>{label}</Text></Pressable></View>
  </View>;
});
const styles=StyleSheet.create({
  card:{padding:16,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,gap:10},
  badges:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:6},badgeGroup:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6,flexShrink:1},
  module:{borderRadius:8,paddingHorizontal:8,paddingVertical:4,backgroundColor:colors.primarySoft},moduleText:{fontSize:12,lineHeight:18,fontWeight:'700',color:colors.primary},
  medium:{borderRadius:8,paddingHorizontal:7,paddingVertical:4,backgroundColor:'#F3F1FA'},small:{fontSize:11,lineHeight:17,fontWeight:'600',color:colors.primary},
  access:{flexDirection:'row',alignItems:'center',gap:4,borderRadius:12,borderWidth:1,paddingHorizontal:8,paddingVertical:4},title:{fontSize:16,lineHeight:25,fontWeight:'700',color:colors.ink},
  status:{alignSelf:'flex-start',maxWidth:'100%',flexDirection:'row',alignItems:'center',gap:5,borderRadius:12,borderWidth:1,borderColor:'#BEB8D9',backgroundColor:colors.primarySoft,paddingHorizontal:8,paddingVertical:4},statusText:{flexShrink:1,fontSize:11,lineHeight:17,fontWeight:'600',color:colors.primary},
  stats:{flexDirection:'row',borderRadius:12,backgroundColor:'#F7F6F3',paddingVertical:9},stat:{flex:1,minWidth:0,alignItems:'center',justifyContent:'center',paddingHorizontal:4,gap:3},middleStat:{borderLeftWidth:1,borderRightWidth:1,borderColor:colors.border},statLabel:{fontSize:11,lineHeight:17,color:colors.muted,textAlign:'center'},statValue:{fontSize:13,lineHeight:19,fontWeight:'700',color:colors.ink,textAlign:'center'},
  score:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:6,borderRadius:12,backgroundColor:'#F0F8F4',paddingHorizontal:10,paddingVertical:8},scoreLabel:{flexDirection:'row',gap:5,alignItems:'center'},scoreValue:{fontSize:12,lineHeight:18,fontWeight:'700',color:'#32966B'},
  actionWrap:{paddingTop:2},action:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,minHeight:44,paddingVertical:10,paddingHorizontal:12,borderRadius:12},actionText:{fontSize:13,lineHeight:20,fontWeight:'700',flexShrink:1,textAlign:'center'},
});
