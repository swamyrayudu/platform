import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Performance } from '@/types/analytics';
import { progressLayout, progressSummary } from '@/utils/progress-summary';
import { resultNumber } from '@/utils/result-summary';
import { colors } from '@/utils/theme';
import { PerformanceChart } from './performance-chart';

export function ProgressOverview({data}:{data:Performance}) {
  const {fontScale}=useWindowDimensions();
  const [width,setWidth]=useState(0);
  const layout=progressLayout(width||200,fontScale);
  const summary=progressSummary(data);
  const trend=data.accuracy_delta_pct;
  return <View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.title}>Overall performance</Text>
    <View onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={styles.content}>
      {summary.accuracy!==null?<>
        <View style={[styles.chartRow,{flexDirection:layout.stackedChart?'column':'row'}]}>
          <PerformanceChart accuracy={summary.accuracy} size={layout.chartSize} correct={summary.correct} remaining={summary.remaining}/>
          <View style={[styles.legend,layout.stackedChart&&{width:'100%'}]}>
            {[{label:'Correct',value:summary.correct,color:colors.green,background:colors.greenSoft},{label:'Wrong or skipped',value:summary.remaining,color:colors.gold,background:colors.soft}].map(item=><View key={item.label} style={[styles.legendItem,{backgroundColor:item.background}]}>
              <View style={styles.legendHeading}><View style={[styles.dot,{backgroundColor:item.color}]}/><Text style={styles.label}>{item.label}</Text></View>
              <Text style={[styles.count,{color:item.color}]}>{item.value.toLocaleString()}<Text style={styles.countLabel}> questions</Text></Text>
            </View>)}
          </View>
        </View>
        <Text style={styles.note}>Practice + submitted mocks. Skipped mock questions count here.</Text>
      </>:<Text style={styles.note}>Subject results are not available yet.</Text>}
      <View style={styles.stats}>
        {[{label:'Recorded questions',value:summary.total,icon:'help-circle-outline' as const},{label:'Mocks completed',value:data.mocks_completed,icon:'document-text-outline' as const}].map(item=><View key={item.label} style={[styles.stat,width?{width:layout.statWidth}:styles.unmeasured]}>
          <Ionicons name={item.icon} size={19} color={colors.primary}/><Text style={styles.statValue}>{item.value.toLocaleString()}</Text><Text style={styles.label}>{item.label}</Text>
        </View>)}
      </View>
      {trend!==null?<View style={styles.trend}>
        <Ionicons name={trend>0?'trending-up-outline':trend<0?'trending-down-outline':'remove-outline'} size={18} color={trend<0?colors.gold:colors.green}/>
        <Text style={styles.trendText}>{trend===0?'Practice accuracy is unchanged':`Practice accuracy ${trend>0?'+':'−'}${resultNumber(Math.abs(trend))} points`}<Text style={styles.note}> · vs earlier practice</Text></Text>
      </View>:null}
    </View>
  </View>;
}
const styles=StyleSheet.create({
  panel:{padding:16,gap:16,borderWidth:1,borderColor:colors.border,borderRadius:22,backgroundColor:colors.card},title:{fontSize:17,lineHeight:26,fontWeight:'700',color:colors.ink},content:{gap:14},
  chartRow:{gap:16,alignItems:'center'},legend:{flexGrow:1,flexShrink:1,gap:10},legendItem:{padding:12,gap:4,borderRadius:14},legendHeading:{flexDirection:'row',alignItems:'center',gap:7},dot:{width:8,height:8,borderRadius:4},label:{flexShrink:1,fontSize:12,lineHeight:20,color:colors.muted},count:{fontSize:22,lineHeight:31,fontWeight:'700'},countLabel:{fontSize:12,fontWeight:'500',color:colors.muted},note:{fontSize:12,lineHeight:20,color:colors.muted},
  stats:{flexDirection:'row',flexWrap:'wrap',gap:10},stat:{minWidth:0,padding:12,gap:4,borderRadius:14,backgroundColor:colors.primarySoft},unmeasured:{flexBasis:'100%'},statValue:{fontSize:23,lineHeight:32,fontWeight:'700',color:colors.primary},
  trend:{flexDirection:'row',alignItems:'center',gap:7,paddingTop:4},trendText:{flex:1,fontSize:12,lineHeight:20,fontWeight:'600',color:colors.ink},
});
