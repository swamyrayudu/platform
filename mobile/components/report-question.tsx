import { Heading } from '@/components/heading';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/services/api-client';
import { FEEDBACK_REASONS, type FeedbackReason, type FeedbackSource } from '@/types/question-feedback';
import { colors } from '@/utils/theme';
import { Button } from './ui';

export const ReportQuestion=memo(function ReportQuestion({uid,question,source,testId}: {uid?:string;question:string;source:FeedbackSource;testId?:string}) {
  const [open,setOpen]=useState(false);
  const [reason,setReason]=useState<FeedbackReason>('wrong_answer');
  const [details,setDetails]=useState('');
  const report=useMutation({mutationFn:()=>api.request('/api/dsc-sgt/questions/feedback','POST',{questionUid:uid,reason,details,source,mockTestId:testId,reportedQuestion:question})});
  if(!uid)return null;
  return <View style={styles.panel}>
    <Pressable accessibilityRole="button" accessibilityLabel="Report a question issue" accessibilityState={{expanded:open,disabled:report.isPending}} disabled={report.isPending} onPress={()=>setOpen(value=>!value)} style={({pressed})=>[styles.toggle,pressed&&styles.pressed]}>
      <Ionicons name="chatbox-ellipses-outline" size={19} color={colors.muted}/>
      <Text style={styles.toggleText}>Report issue</Text>
      <Ionicons name={open?'chevron-up':'chevron-down'} size={17} color={colors.muted}/>
    </Pressable>
    {open ? <View style={styles.form}>
      {report.isSuccess ? <View accessibilityLiveRegion="polite" style={styles.confirmation}>
        <Ionicons name="checkmark-circle" size={21} color={colors.green}/>
        <Text style={styles.confirmationText}>Thank you. Your report has been recorded.</Text>
      </View> : <>
        <Heading style={styles.heading}>What needs fixing?</Heading>
        <View accessibilityRole="radiogroup" style={styles.reasons}>
          {FEEDBACK_REASONS.map(item=><Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={item.label} accessibilityState={{checked:reason===item.id,disabled:report.isPending}} disabled={report.isPending} onPress={()=>setReason(item.id)} style={({pressed})=>[styles.reason,reason===item.id&&styles.selected,pressed&&styles.pressed]}>
            <Ionicons name={reason===item.id?'radio-button-on':'radio-button-off'} size={19} color={reason===item.id?colors.primary:colors.muted}/>
            <Text style={styles.reasonText}>{item.label}</Text>
          </Pressable>)}
        </View>
        <View style={styles.detailsHeader}>
          <Text style={styles.label}>{reason==='other'?'Details (required)':'Details (optional)'}</Text>
          <Text style={styles.counter}>{details.length}/1,000</Text>
        </View>
        <TextInput accessibilityLabel={reason==='other'?'Report details, required':'Report details, optional'} placeholder="Describe the issue…" placeholderTextColor={colors.muted} style={styles.input} value={details} onChangeText={text=>setDetails(text.slice(0,1000))} maxLength={1000} editable={!report.isPending} multiline autoCapitalize="sentences" textAlignVertical="top"/>
        {report.error ? <Text accessibilityRole="alert" style={styles.error}>{report.error instanceof Error?report.error.message:'Could not send your report. Please try again.'}</Text> : null}
        <Button label="Send report" disabled={reason==='other'&&!details.trim()} busy={report.isPending} onPress={()=>report.mutate()}/>
      </>}
    </View> : null}
  </View>;
});

const styles=StyleSheet.create({
  panel:{width:'100%',minWidth:0,borderWidth:1,borderColor:colors.border,borderRadius:16,backgroundColor:colors.card},
  toggle:{minHeight:48,paddingHorizontal:14,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:10},
  toggleText:{flex:1,minWidth:0,fontSize:13,lineHeight:20,fontWeight:'600',color:colors.muted},
  pressed:{opacity:.7},form:{padding:14,paddingTop:0,gap:12},heading:{},
  reasons:{gap:6},reason:{minHeight:44,paddingHorizontal:10,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:colors.border,borderRadius:12},
  selected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},reasonText:{flex:1,minWidth:0,fontSize:13,lineHeight:20,color:colors.ink},
  detailsHeader:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:6},label:{fontSize:12,lineHeight:19,fontWeight:'600',color:colors.muted},counter:{fontSize:11,lineHeight:18,color:colors.muted,fontVariant:['tabular-nums']},
  input:{minHeight:100,padding:12,borderRadius:12,borderWidth:1,borderColor:colors.border,fontSize:15,lineHeight:23,color:colors.ink,backgroundColor:colors.card},
  error:{fontSize:13,lineHeight:21,color:colors.red},confirmation:{flexDirection:'row',alignItems:'flex-start',gap:9,padding:12,borderRadius:12,backgroundColor:colors.greenSoft},confirmationText:{flex:1,minWidth:0,fontSize:13,lineHeight:21,color:colors.green},
});
