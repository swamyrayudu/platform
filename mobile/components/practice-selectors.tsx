import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, subjectStyle } from '@/utils/theme';
import { pageLayout } from '@/utils/layout';
import type { PracticeMedium } from '@/types/practice';
import { PRACTICE_SUBJECTS } from '@/utils/practice-subjects';
import { PracticeChoices } from './practice-choices';

export function PracticeMediumTabs({value,onChange}:{value:PracticeMedium;onChange:(medium:PracticeMedium)=>void}) {
  return <View style={styles.medium}>{([{value:'english',label:'English Medium',icon:'globe-outline'},{value:'telugu',label:'తెలుగు మీడియం',icon:'language-outline'}] as const).map(item=>{
    const selected=value===item.value;
    return <Pressable key={item.value} accessibilityRole="button" accessibilityState={{selected}} accessibilityLabel={item.label} onPress={()=>onChange(item.value)} style={[styles.mediumTab,selected&&styles.mediumSelected]}><Ionicons name={item.icon} size={16} color={selected?colors.primary:colors.muted}/><Text style={[styles.mediumText,{color:selected?colors.ink:colors.muted}]}>{item.label}</Text></Pressable>;
  })}</View>;
}
export function PracticeSubjects({selected,onSelect}:{selected:string;onSelect:(subject:string)=>void}) {
  const {width,height,fontScale}=useWindowDimensions();const insets=useSafeAreaInsets();
  const {subjectColumns}=pageLayout(width-insets.left-insets.right,height,fontScale);
  return <PracticeChoices columns={subjectColumns} items={PRACTICE_SUBJECTS.map(subject=>({...subjectStyle(subject.name),value:subject.name,label:subject.name,detail:subject.teluguName}))} selected={selected} onSelect={onSelect}/>;
}
export function PracticeDataStatus({checking,count}:{checking:boolean;count?:number}) {
  return <View accessibilityLiveRegion="polite" style={styles.dataStatus}>{checking?<ActivityIndicator size="small" color={colors.primary}/>:null}<Text style={styles.statusText}>{checking?'Checking available questions…':count!==undefined?`${count} matching questions`:'Choose a subject to get started.'}</Text></View>;
}
const styles=StyleSheet.create({
  medium:{flexDirection:'row',gap:6,padding:4,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:'#F6F5F2'},mediumTab:{flex:1,minWidth:0,minHeight:48,paddingHorizontal:8,paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderRadius:12,borderWidth:1,borderColor:'transparent'},mediumSelected:{backgroundColor:colors.card,borderColor:colors.border},mediumText:{flexShrink:1,minWidth:0,textAlign:'center',fontSize:12,lineHeight:19,fontWeight:'600'},
  dataStatus:{minHeight:28,flexDirection:'row',alignItems:'center',gap:8},statusText:{fontSize:12,lineHeight:19,color:colors.muted,flexShrink:1},
});
