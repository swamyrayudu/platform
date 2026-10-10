import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ExamDraft } from '@/store/exam';
import { paletteCounts, paletteGeometry, paletteSections, type PaletteFilter } from '@/utils/question-palette';
import { colors } from '@/utils/theme';

export function QuestionPalette({draft,onClose,onJump,disabled}:{draft:ExamDraft;onClose:()=>void;onJump:(index:number)=>void;disabled:boolean}) {
  const [filter,setFilter]=useState<PaletteFilter>('all');
  const {width,fontScale}=useWindowDimensions();const insets=useSafeAreaInsets();
  const geometry=paletteGeometry(width-insets.left-insets.right,fontScale);
  const counts=useMemo(()=>paletteCounts(draft.questions,draft.answers),[draft.questions,draft.answers]);
  const sections=useMemo(()=>paletteSections(draft.questions,draft.answers,filter),[draft.questions,draft.answers,filter]);
  return <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close question palette"/>
      <SafeAreaView edges={['top','bottom','right']} style={[styles.panel,{width:geometry.width+insets.right}]} accessibilityViewIsModal onAccessibilityEscape={onClose}>
        <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>QUESTION PALETTE</Text><Pressable accessibilityRole="button" accessibilityLabel="Close question palette" onPress={onClose} style={styles.close}><Ionicons name="close" size={21} color={colors.muted}/></Pressable></View>
        <View style={styles.filters}>{([{value:'all',label:'All'},{value:'unanswered',label:'Not done'},{value:'marked',label:'Flagged'},{value:'answered',label:'Done'}] as const).map(item=><Pressable key={item.value} accessibilityRole="button" accessibilityState={{selected:filter===item.value}} onPress={()=>setFilter(item.value)} style={[styles.filter,filter===item.value&&styles.activeFilter]}><Text style={[styles.filterText,filter===item.value&&{color:'#fff'}]}>{item.label} {counts[item.value]}</Text></Pressable>)}</View>
        <ScrollView contentContainerStyle={styles.sections} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
          {sections.length ? sections.map(section=><View key={section.id} style={{gap:8}}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{section.title.toUpperCase()} ({section.questions.length})</Text>
            <View style={styles.grid}>{section.questions.map(({question,index})=>{
              const answer=draft.answers[question.key];const current=index===draft.index;const done=!!answer?.option;const marked=!!answer?.marked;
              const background=current?colors.primary:marked?'#D99524':done?'#32966B':'#F4F3F1';
              return <Pressable key={question.key} accessibilityRole="button" accessibilityLabel={`Question ${question.number}, ${done?'done':'not done'}${marked?', flagged':''}${current?', current':''}`} accessibilityState={{selected:current,disabled}} disabled={disabled} onPress={()=>onJump(index)} style={({pressed})=>[styles.cell,{width:geometry.cellWidth,minHeight:geometry.cellHeight,backgroundColor:background,borderColor:current?colors.primary:colors.border},pressed&&{opacity:.7},disabled&&{opacity:.5}]}><Text style={{fontSize:13,fontWeight:current||marked||done?'700':'500',color:current||marked||done?'#fff':colors.muted}}>{question.number}</Text></Pressable>;
            })}</View>
          </View>) : <Text style={styles.filterText}>No questions match this filter.</Text>}
          <Text style={styles.legend}>Indigo: current · Green: done · Amber: flagged</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  </Modal>;
}
const styles=StyleSheet.create({
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,.60)',alignItems:'flex-end'},panel:{height:'100%',backgroundColor:colors.card,borderLeftWidth:1,borderLeftColor:colors.border},
  heading:{paddingLeft:16,paddingRight:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},title:{fontSize:12,fontWeight:'700',color:colors.muted,flexShrink:1},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  filters:{flexDirection:'row',flexWrap:'wrap',gap:6,paddingHorizontal:16,paddingBottom:16},filter:{borderWidth:1,borderColor:colors.border,borderRadius:24,paddingHorizontal:12,paddingVertical:10,minHeight:44,justifyContent:'center'},activeFilter:{backgroundColor:colors.primary,borderColor:colors.primary},filterText:{fontSize:12,color:colors.muted},
  sections:{paddingHorizontal:16,paddingBottom:24,gap:22},sectionTitle:{fontSize:11,lineHeight:17,fontWeight:'600',color:colors.muted},grid:{flexDirection:'row',flexWrap:'wrap',gap:6},cell:{borderRadius:10,borderWidth:1,alignItems:'center',justifyContent:'center'},legend:{fontSize:11,lineHeight:18,color:colors.muted},
});
