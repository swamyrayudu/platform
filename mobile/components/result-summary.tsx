import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { MockTestResultSummary } from '@/types/mock-tests';
import type { PracticeResultSummary } from '@/types/practice';
import { resultNumber, resultSummary } from '@/utils/result-summary';
import { pageLayout, resultCountLayout } from '@/utils/layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/utils/theme';

export function ResultSummary({result,title}:{result:MockTestResultSummary|PracticeResultSummary;title:string}) {
  const summary=resultSummary(result);const {width:screenWidth,fontScale}=useWindowDimensions();const insets=useSafeAreaInsets();
  const available=screenWidth-insets.left-insets.right;const page=pageLayout(available,800,fontScale);
  const [width,setWidth]=useState(()=>Math.max(0,page.contentWidth-page.padding*2-34));const grid=resultCountLayout(width,fontScale);
  return <View style={styles.panel}>
    <View style={styles.complete}><Ionicons name="checkmark-circle" size={18} color={colors.green}/><Text style={styles.completeText}>Test completed</Text></View>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    <View style={styles.scorePanel}>
      <Text style={styles.scoreLabel}>{summary.scoreLabel}</Text>
      <Text style={styles.score}>{resultNumber(summary.score)}<Text style={styles.total}> / {resultNumber(summary.total)}</Text></Text>
      {summary.scorePercent!==null?<Text style={styles.scoreDetail}>{resultNumber(summary.scorePercent)}% of total marks</Text>:null}
    </View>
    <View style={styles.counts} onLayout={event=>setWidth(event.nativeEvent.layout.width)}>
      {[{label:'Correct',value:summary.correct,color:colors.green,background:colors.greenSoft},{label:'Wrong',value:summary.wrong,color:colors.red,background:colors.redSoft},{label:'Skipped',value:summary.skipped,color:colors.muted,background:'#F5F4F1'}].map(item=><View key={item.label} style={[styles.count,width?{width:grid.itemWidth}:styles.unmeasured,{backgroundColor:item.background}]}><Text style={[styles.countValue,{color:item.color}]}>{item.value}</Text><Text style={[styles.countLabel,{color:item.color}]}>{item.label}</Text></View>)}
    </View>
    <Text style={styles.detail}>{result.total_questions} questions · Time {summary.time}</Text>
    <View style={styles.accuracy}><Text style={styles.accuracyLabel}>Answer accuracy</Text><Text style={styles.accuracyValue}>{summary.answeredAccuracy===null?'—':`${resultNumber(summary.answeredAccuracy)}%`}</Text></View>
    <Text style={styles.hint}>Correct answers out of questions you answered.</Text>
  </View>;
}
const styles=StyleSheet.create({
  panel:{padding:16,gap:12,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card},
  complete:{flexDirection:'row',alignItems:'center',gap:7},completeText:{flexShrink:1,fontSize:12,lineHeight:19,fontWeight:'600',color:colors.green},title:{fontSize:17,lineHeight:27,fontWeight:'700',color:colors.ink},
  scorePanel:{padding:16,gap:4,borderRadius:16,backgroundColor:colors.primarySoft},scoreLabel:{fontSize:12,lineHeight:19,color:colors.primary,fontWeight:'600'},score:{fontSize:34,lineHeight:46,fontWeight:'800',color:colors.primary},total:{fontSize:19,fontWeight:'600'},scoreDetail:{fontSize:12,lineHeight:19,color:colors.muted},
  counts:{flexDirection:'row',flexWrap:'wrap',gap:8},count:{minWidth:0,paddingHorizontal:8,paddingVertical:12,borderRadius:12,gap:3,alignItems:'center'},unmeasured:{flexGrow:1,flexBasis:0},countValue:{fontSize:22,lineHeight:30,fontWeight:'700'},countLabel:{fontSize:12,lineHeight:19,fontWeight:'600',textAlign:'center'},
  detail:{fontSize:12,lineHeight:19,color:colors.muted},accuracy:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:6},accuracyLabel:{fontSize:13,lineHeight:21,color:colors.ink,fontWeight:'600'},accuracyValue:{fontSize:15,lineHeight:23,color:colors.primary,fontWeight:'700'},hint:{fontSize:11,lineHeight:18,color:colors.muted,marginTop:-8},
});
