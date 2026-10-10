import { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useKeepAwake } from 'expo-keep-awake';
import { Card, Body, Heading, Button, ErrorState, Loading, Bar, s } from '@/components/ui';
import { QuestionPalette } from '@/components/question-palette';
import { useExam } from '@/hooks/use-exam';
import type { ExamKind } from '@/store/exam';
import { colors } from '@/utils/theme';
import { paletteCounts } from '@/utils/question-palette';
import { ReportQuestion } from '@/components/report-question';

export default function Exam() {
  useKeepAwake();
  const {fontScale}=useWindowDimensions();
  const params=useLocalSearchParams<{kind:ExamKind;id:string}>();
  const exam=useExam(params.kind==='mock'?'mock':'practice',params.id);
  const [paletteOpen,setPaletteOpen]=useState(false);
  const scroll=useRef<ScrollView>(null);
  const openLeave=()=>Alert.alert('Leave this exam?','Your answers will be kept.',[{text:'Stay',style:'cancel'},{text:'Save & leave',onPress:()=>void exam.leave()}]);
  usePreventRemove(!!exam.draft&&!exam.busy,()=>Alert.alert('Exam in progress','Use Save & leave to preserve your exam.'));
  useEffect(()=>{
    const listener=BackHandler.addEventListener('hardwareBackPress',()=>{openLeave();return true;});
    return()=>listener.remove();
  });
  const d=exam.draft;const q=d?.questions[d.index];const a=q?d?.answers[q.key]:undefined;
  const remaining=d&&d.duration>0?Math.max(0,d.duration-d.elapsed):null;
  const time=remaining??d?.elapsed??0;
  const locked=!!d?.submitIntent||remaining===0||exam.busy;
  const answerLocked=locked||!!(q&&d?.feedbackMode==='instant'&&d.feedback[q.key]);
  const counts=d?paletteCounts(d.questions,d.answers):undefined;
  function move(index:number) {
    if(exam.busy)return;
    setPaletteOpen(false);void exam.move(index);
    scroll.current?.scrollTo({y:0,animated:false});
  }
  function submit() {
    if(!d)return;
    if(d.submitIntent){void exam.submit();return;}
    Alert.alert('Submit your exam?',`${counts!.unanswered} unanswered questions. Results are scored by the server.`,[{text:'Keep working',style:'cancel'},{text:'Submit',onPress:()=>void exam.submit()}]);
  }
  return <SafeAreaView edges={['top','left','right','bottom']} style={styles.screen}>
    <View style={styles.topbar}>
      <View style={[styles.leading,{minWidth:44+72*fontScale}]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Save and leave exam" disabled={exam.busy} onPress={openLeave} style={styles.iconButton}><Ionicons name="arrow-back" size={20} color={colors.muted}/></Pressable>
      <Text style={styles.position}>Q{q?.number??'—'}<Text style={{color:colors.muted}}> / {d?.questions.length??'—'}</Text></Text>
      </View>
      <View style={styles.topActions}>
      <View accessibilityLabel={`${Math.floor(time/60)} minutes ${time%60} seconds ${remaining===null?'elapsed':'remaining'}`} style={styles.clock}><Ionicons name="time-outline" size={16} color={remaining!==null&&remaining<=300?colors.red:colors.primary}/><Text style={[styles.clockText,remaining!==null&&remaining<=300&&{color:colors.red}]}>{Math.floor(time/60)}:{String(time%60).padStart(2,'0')}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open question palette" accessibilityState={{expanded:paletteOpen,disabled:!d}} disabled={!d} onPress={()=>setPaletteOpen(true)} style={styles.iconButton}><Ionicons name="grid-outline" size={21} color={colors.primary}/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={d?.submitIntent?'Retry final submission':'Submit exam'} accessibilityState={{disabled:!d||exam.busy}} disabled={!d||exam.busy} onPress={submit} style={[styles.iconButton,styles.finish,(!d||exam.busy)&&{opacity:.45}]}><Ionicons name="checkmark" size={21} color="#fff"/></Pressable>
      </View>
    </View>
    {d ? <View style={styles.progress}><Text style={styles.progressText}>{counts!.answered}/{counts!.all} done · {counts!.marked} flagged{Object.keys(d.pending).length?` · ${Object.keys(d.pending).length} awaiting sync`:''}</Text><Bar value={100*(d.index+1)/Math.max(1,d.questions.length)}/></View> : null}
    <ScrollView ref={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {exam.loading ? <Loading/> : null}
      {exam.error ? <ErrorState error={exam.error} retry={d?()=>void exam.sync():exam.retry}/> : null}
      {d&&q ? <View key={q.key} style={{gap:16}}>
        <Text accessibilityRole="header" style={styles.testTitle}>{d.title}</Text>
        <Card>
          <Text style={styles.questionMeta}>QUESTION {q.number} · {q.section||q.subject}</Text>
          {q.topic ? <Text style={styles.topic}>{q.topic}</Text> : null}
          <Text style={styles.question}>{q.question}</Text>
          {(['A','B','C','D'] as const).map(option=><Pressable key={option} accessibilityRole="radio" accessibilityLabel={`${option}. ${q[`option_${option.toLowerCase()}` as 'option_a'|'option_b'|'option_c'|'option_d']}`} accessibilityState={{checked:a?.option===option,disabled:answerLocked}} disabled={answerLocked} onPress={()=>void exam.select(option)} style={[styles.option,a?.option===option&&styles.selectedOption]}><View style={[styles.optionLetter,a?.option===option&&{backgroundColor:colors.primary}]}><Text style={{fontSize:13,fontWeight:'700',color:a?.option===option?'#fff':colors.muted}}>{option}</Text></View><Text style={styles.optionText}>{q[`option_${option.toLowerCase()}` as 'option_a'|'option_b'|'option_c'|'option_d']}</Text>{a?.option===option ? <Ionicons name="checkmark-circle" color={colors.primary} size={19}/> : null}</Pressable>)}
          <View style={s.row}><View style={{flexGrow:1,flexBasis:150}}><Button secondary icon="flag-outline" label={a?.marked?'Unflag question':'Flag for review'} disabled={locked} onPress={()=>void exam.select(a?.option??null,!a?.marked)}/></View><View style={{flexGrow:1,flexBasis:100}}><Button secondary label="Clear answer" disabled={answerLocked||!a?.option} onPress={()=>void exam.select(null)}/></View></View>
          {d.feedbackMode==='instant' ? <Button label="Check answer" busy={exam.busy} disabled={!a?.option||answerLocked} onPress={()=>void exam.sync()}/> : null}
          {d.feedbackMode==='instant'&&d.feedback[q.key] ? <Card gold><Heading>{d.feedback[q.key].is_correct?'Correct!':'Keep learning'}</Heading><Body>Correct answer: {d.feedback[q.key].correct_answer}</Body><Body>{d.feedback[q.key].explanation||'No explanation is available for this question.'}</Body></Card> : null}
          <ReportQuestion uid={q.uid} question={q.question} source={d.kind==='mock'?'mock_exam':'practice_exam'} testId={d.testId}/>
        </Card>
        {Object.keys(d.pending).length>0 ? <Button secondary label="Sync saved answers" busy={exam.busy} onPress={()=>void exam.sync()}/> : null}
        {d.submitIntent ? <Button label="Retry final submission" busy={exam.busy} onPress={submit}/> : null}
        <Button secondary label="Save & leave" busy={exam.busy} onPress={()=>void exam.leave()}/>
        <Button danger label="End and leave" disabled={exam.busy||d.submitIntent} onPress={()=>Alert.alert('End this session?','This uses the website’s existing end-session rules. Free practice will consume your trial.',[{text:'Stay',style:'cancel'},{text:'End session',style:'destructive',onPress:()=>void exam.leave(true)}])}/>
      </View> : null}
    </ScrollView>
    {d ? <View style={styles.bottom}><View style={{flexGrow:1,flexBasis:Math.max(120,110*fontScale)}}><Button secondary icon="chevron-back-outline" label="Previous" disabled={d.index===0||exam.busy} onPress={()=>move(d.index-1)}/></View><View style={{flexGrow:1,flexBasis:Math.max(120,110*fontScale)}}>{d.index===d.questions.length-1 ? <Button icon="checkmark-outline" label="Submit" busy={exam.busy} onPress={submit}/> : <Button icon="chevron-forward-outline" label="Next" disabled={exam.busy} onPress={()=>move(d.index+1)}/>}</View></View> : null}
    {paletteOpen&&d ? <QuestionPalette draft={d} disabled={exam.busy} onClose={()=>setPaletteOpen(false)} onJump={move}/> : null}
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background},topbar:{paddingHorizontal:8,paddingVertical:6,gap:4,flexDirection:'row',flexWrap:'wrap',alignItems:'center',backgroundColor:colors.card,borderBottomWidth:1,borderBottomColor:colors.border},leading:{flexGrow:1,flexDirection:'row',alignItems:'center',gap:4},topActions:{flexDirection:'row',alignItems:'center',gap:4,marginLeft:'auto'},
  iconButton:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:13},position:{flex:1,fontSize:12,fontWeight:'700',color:colors.ink},clock:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:8,paddingVertical:7,borderRadius:11,backgroundColor:'#F6F5F3'},clockText:{fontSize:14,fontWeight:'700',color:colors.primary,fontVariant:['tabular-nums']},finish:{backgroundColor:colors.primary},
  progress:{paddingHorizontal:16,paddingTop:10,paddingBottom:4,gap:7},progressText:{fontSize:11,lineHeight:17,color:colors.muted},content:{padding:16,paddingBottom:24,gap:16,maxWidth:760,width:'100%',alignSelf:'center'},testTitle:{fontSize:13,lineHeight:21,color:colors.muted,fontWeight:'600'},questionMeta:{fontSize:11,lineHeight:18,fontWeight:'700',color:colors.muted},topic:{fontSize:12,lineHeight:19,color:colors.muted},question:{fontSize:18,lineHeight:29,fontWeight:'600',color:colors.ink},
  option:{flexDirection:'row',alignItems:'center',padding:13,gap:10,minHeight:54,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card},selectedOption:{borderColor:colors.primary,backgroundColor:colors.primarySoft},optionLetter:{width:26,height:26,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:'#F4F3F1'},optionText:{flex:1,fontSize:15,lineHeight:24,color:colors.ink},bottom:{flexDirection:'row',flexWrap:'wrap',gap:10,paddingHorizontal:16,paddingVertical:10,borderTopWidth:1,borderTopColor:colors.border,backgroundColor:colors.card},
});
