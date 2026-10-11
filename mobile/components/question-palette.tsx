import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ExamDraft } from '@/store/exam';
import { paletteGeometry, paletteRows, type PaletteRow } from '@/utils/question-palette';
import { colors } from '@/utils/theme';

type PaletteProps = Pick<ExamDraft,'questions'|'answers'|'index'> & {onClose:()=>void;onJump:(index:number)=>void;disabled:boolean};
const PAGE_ROWS=10;
const rowKey=(row:PaletteRow)=>row.key;
const rowLayout=(rows:ArrayLike<PaletteRow>|null|undefined,index:number)=>({index,length:rows![index].height,offset:rows![index].offset});
export const QuestionPalette=memo(function QuestionPalette({questions,answers,index:currentIndex,onClose,onJump,disabled}:PaletteProps) {
  const [visibleRows,setVisibleRows]=useState(PAGE_ROWS);
  const {width,fontScale}=useWindowDimensions();const insets=useSafeAreaInsets();
  const geometry=paletteGeometry(width-insets.left-insets.right,fontScale);
  const rows=useMemo(()=>paletteRows(questions,geometry.columns,geometry.cellHeight,fontScale),[questions,geometry.columns,geometry.cellHeight,fontScale]);
  const data=useMemo(()=>rows.slice(0,visibleRows),[rows,visibleRows]);
  const loadMore=useCallback(()=>setVisibleRows(count=>Math.min(rows.length,count+PAGE_ROWS)),[rows.length]);
  const renderRow=useCallback(({item}:ListRenderItemInfo<PaletteRow>)=>item.type==='heading'
    ? <View style={[styles.sectionHeading,{height:item.height}]}><Text accessibilityRole="header" numberOfLines={2} style={styles.sectionTitle}>{item.title.toUpperCase()} ({item.count})</Text></View>
    : <View style={[styles.grid,{height:item.height}]}>{item.questions.map(({question,index})=>{
      const answer=answers[question.key],current=index===currentIndex,done=!!answer?.option,marked=!!answer?.marked;
      const background=current?colors.primary:marked?'#D99524':done?'#32966B':'#F4F3F1';
      return <Pressable key={question.key} accessibilityRole="button" accessibilityLabel={`Question ${question.number}${done?', answered':''}${marked?', marked for review':''}${current?', current':''}`} accessibilityState={{selected:current,disabled}} disabled={disabled} onPress={()=>onJump(index)} style={({pressed})=>[styles.cell,{width:geometry.cellWidth,height:geometry.cellHeight,backgroundColor:background,borderColor:current?colors.primary:colors.border},pressed&&{opacity:.7},disabled&&{opacity:.5}]}><Text style={{fontSize:13,fontWeight:current||marked||done?'700':'500',color:current||marked||done?'#fff':colors.muted}}>{question.number}</Text></Pressable>;
    })}</View>,[answers,currentIndex,disabled,onJump,geometry.cellWidth,geometry.cellHeight]);
  return <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close question palette"/>
      <SafeAreaView edges={['top','bottom','right']} style={[styles.panel,{width:geometry.width+insets.right}]} accessibilityViewIsModal onAccessibilityEscape={onClose}>
        <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>QUESTION PALETTE</Text><Pressable accessibilityRole="button" accessibilityLabel="Close question palette" onPress={onClose} style={styles.close}><Ionicons name="close" size={21} color={colors.muted}/></Pressable></View>
        <Text style={styles.summary}>All questions · {questions.length}</Text>
        <FlatList key={`${geometry.columns}:${fontScale}`} style={styles.list} data={data} renderItem={renderRow} keyExtractor={rowKey} getItemLayout={rowLayout} initialNumToRender={6} maxToRenderPerBatch={4} updateCellsBatchingPeriod={16} windowSize={5} onEndReached={loadMore} onEndReachedThreshold={.5} contentContainerStyle={styles.sections} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled"/>
      </SafeAreaView>
    </View>
  </Modal>;
});
const styles=StyleSheet.create({
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,.60)',alignItems:'flex-end'},panel:{height:'100%',backgroundColor:colors.card,borderLeftWidth:1,borderLeftColor:colors.border},
  heading:{paddingLeft:16,paddingRight:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},title:{fontSize:12,fontWeight:'700',color:colors.muted,flexShrink:1},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  summary:{fontSize:12,color:colors.muted,paddingHorizontal:16,paddingBottom:10},list:{flex:1},
  sections:{paddingHorizontal:16,paddingBottom:24},sectionHeading:{justifyContent:'flex-end',paddingTop:8,paddingBottom:6},sectionTitle:{fontSize:11,lineHeight:17,fontWeight:'600',color:colors.muted},grid:{flexDirection:'row',gap:6,paddingBottom:6},cell:{borderRadius:10,borderWidth:1,alignItems:'center',justifyContent:'center'},
});
