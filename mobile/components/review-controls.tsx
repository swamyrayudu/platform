import { Heading } from '@/components/heading';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '@/utils/theme';
import type { ReviewSubject } from '@/utils/question-review';
import { Button } from './ui';

export function ReviewSubjectPicker({subjects,total,selected,onSelect}:{subjects:ReviewSubject[];total:number;selected:string;onSelect:(value:string)=>void}) {
  const [open,setOpen]=useState(false);
  const current=subjects.find(subject=>subject.value===selected);
  const options=[{value:'',label:'All subjects',count:total},...subjects];
  const choose=(value:string)=>{onSelect(value);setOpen(false);};
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Subject: ${current?.label||'All subjects'}. Choose subject`} accessibilityState={{expanded:open}} onPress={()=>setOpen(true)} style={styles.selector}>
      <View style={styles.subjectText}><Text style={styles.caption}>Subject</Text><Text style={styles.subjectName}>{current?.label||'All subjects'}</Text></View>
      <Ionicons name="chevron-down" size={20} color={colors.primary}/>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={()=>setOpen(false)}>
      <SafeAreaView style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close subject selector" onPress={()=>setOpen(false)}/>
        <View accessibilityViewIsModal onAccessibilityEscape={()=>setOpen(false)} style={styles.panel}>
          <View style={styles.modalHeader}><Heading style={styles.title}>Choose subject</Heading><Pressable accessibilityRole="button" accessibilityLabel="Close subject selector" onPress={()=>setOpen(false)} style={styles.close}><Ionicons name="close" size={22} color={colors.primary}/></Pressable></View>
          <FlatList data={options} keyExtractor={item=>item.value||'all'} showsVerticalScrollIndicator={false} extraData={selected} contentContainerStyle={styles.options} renderItem={({item})=><Pressable accessibilityRole="radio" accessibilityState={{checked:selected===item.value}} onPress={()=>choose(item.value)} style={[styles.option,selected===item.value&&styles.selected]}>
            <View style={styles.subjectText}><Text style={styles.subjectName}>{item.label}</Text><Text style={styles.caption}>{item.count} questions</Text></View>
            <Ionicons name={selected===item.value?'radio-button-on':'radio-button-off'} size={22} color={selected===item.value?colors.primary:colors.muted}/>
          </Pressable>}/>
        </View>
      </SafeAreaView>
    </Modal>
  </>;
}

export function ReviewPagination({page,pages,from,to,total,onChange}:{page:number;pages:number;from:number;to:number;total:number;onChange:(page:number)=>void}) {
  const {width,fontScale}=useWindowDimensions();
  const stacked=Math.min(width-32,720)<280*Math.max(1,fontScale);
  if(!total)return null;
  return <View style={styles.pagination}>
    <View style={styles.pageInfo}><Text accessibilityLiveRegion="polite" style={styles.caption}>{from}–{to} of {total} questions</Text><Text style={styles.caption}>Page {page} / {pages}</Text></View>
    {pages>1?<View style={[styles.actions,{flexDirection:stacked?'column':'row'}]}>
      <View style={[styles.action,stacked&&styles.stackedAction]}><Button secondary icon="chevron-back" label="Previous" disabled={page<=1} onPress={()=>onChange(page-1)}/></View>
      <View style={[styles.action,stacked&&styles.stackedAction]}><Button icon="chevron-forward" label="Next" disabled={page>=pages} onPress={()=>onChange(page+1)}/></View>
    </View>:null}
  </View>;
}

const styles=StyleSheet.create({
  selector:{minHeight:60,padding:14,borderWidth:1,borderColor:colors.border,borderRadius:16,backgroundColor:colors.card,flexDirection:'row',alignItems:'center',gap:12},
  subjectText:{flex:1,minWidth:0,gap:3},subjectName:{fontSize:14,lineHeight:23,fontWeight:'600',color:colors.ink},caption:{fontSize:12,lineHeight:20,color:colors.muted},
  overlay:{flex:1,padding:16,justifyContent:'center',alignItems:'center',backgroundColor:'rgba(27,26,46,.55)'},
  panel:{width:'100%',maxWidth:520,maxHeight:'85%',flexShrink:1,backgroundColor:colors.card,borderRadius:20,overflow:'hidden'},
  modalHeader:{paddingHorizontal:16,paddingVertical:10,gap:10,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:colors.border},title:{flex:1},close:{width:44,minHeight:44,alignItems:'center',justifyContent:'center'},
  options:{padding:12,gap:8},option:{minHeight:64,padding:12,gap:12,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:colors.border,borderRadius:14},selected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  pagination:{gap:10},pageInfo:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:6},actions:{gap:10},action:{flex:1,minWidth:0},stackedAction:{flex:0},
});
