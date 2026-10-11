import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useKeepAwake } from 'expo-keep-awake';
import { Card, Body, Heading, Button, ErrorState, Loading, Bar, s } from '@/components/ui';
import { QuestionPalette } from '@/components/question-palette';
import { useExam } from '@/hooks/use-exam';
import type { ExamKind } from '@/store/exam';
import { colors } from '@/utils/theme';
import { paletteCounts } from '@/utils/question-palette';
import { ReportQuestion } from '@/components/report-question';
import { pageLayout } from '@/utils/layout';

export default function Exam() {
  useKeepAwake();
  const {width,height,fontScale}=useWindowDimensions();const insets=useSafeAreaInsets();
  const layout=pageLayout(width-insets.left-insets.right,height-insets.top-insets.bottom,fontScale);
  const params=useLocalSearchParams<{kind:ExamKind;id:string}>();
  const exam=useExam(params.kind==='mock'?'mock':'practice',params.id);
  const {busy,exitDestination,leave:leaveExam,move:moveQuestion}=exam;
  const [paletteOpen,setPaletteOpen]=useState(false);
  const scroll=useRef<ScrollView>(null);
  const hasDraft=!!exam.draft;const leavePromptOpen=useRef(false);
  const closePalette=useCallback(()=>setPaletteOpen(false),[]);
  const openLeave=useCallback(()=>{
    if(paletteOpen){closePalette();return;}
    if(busy||exitDestination||leavePromptOpen.current)return;
    if(!hasDraft){if(router.canGoBack())router.back();else router.replace(params.kind==='mock'?'/(tabs)/mocks':'/(tabs)/practice');return;}
    leavePromptOpen.current=true;
    const dismiss=()=>{leavePromptOpen.current=false;};
    const isMock=params.kind==='mock';
    Alert.alert(isMock?'Pause and leave this exam?':'Pause and leave practice?',`Stop the timer and save your answers, then return to ${isMock?'Mock Tests':'Practice'}. You can resume later.`,[{text:'Stay',style:'cancel',onPress:dismiss},{text:'Stop timer & save',onPress:()=>{dismiss();void leaveExam();}}],{cancelable:true,onDismiss:dismiss});
  },[paletteOpen,closePalette,busy,exitDestination,leaveExam,hasDraft,params.kind]);
  usePreventRemove(hasDraft&&!exam.exitDestination,openLeave);
  // Remove the navigation guard before dispatching an exit that has finished
  // saving. Back gestures stay guarded during sync and failed saves.
  useEffect(()=>{
    if(!exam.exitDestination)return;
    const frame=requestAnimationFrame(()=>router.replace(exam.exitDestination!));
    return()=>cancelAnimationFrame(frame);
  },[exam.exitDestination]);
  useEffect(()=>{
    if(!hasDraft||exam.exitDestination)return;
    const listener=BackHandler.addEventListener('hardwareBackPress',()=>{openLeave();return true;});
    return()=>listener.remove();
  },[hasDraft,exam.exitDestination,openLeave]);
  const d=exam.draft;const q=d?.questions[d.index];const a=q?d?.answers[q.key]:undefined;
  const remaining=d&&d.duration>0?Math.max(0,d.duration-d.elapsed):null;
  const time=remaining??d?.elapsed??0;
  const locked=!!d?.submitIntent||remaining===0||exam.busy||!!exam.exitDestination;
  const answerLocked=locked||!!(q&&d?.feedbackMode==='instant'&&d.feedback[q.key]);
  const feedback=q&&d?.feedbackMode==='instant'?d.feedback[q.key]:undefined;
  const questions=d?.questions,answers=d?.answers;
  const counts=useMemo(()=>questions&&answers?paletteCounts(questions,answers):undefined,[questions,answers]);
  const move=useCallback((index:number)=>{
    if(busy||exitDestination)return;
    setPaletteOpen(false);void moveQuestion(index);
    scroll.current?.scrollTo({y:0,animated:false});
  },[busy,exitDestination,moveQuestion]);
  function submit() {
    if(!d)return;
    if(d.submitIntent){void exam.submit();return;}
    Alert.alert('Submit your exam?',`${counts!.unanswered} unanswered questions. Results are scored by the server.`,[{text:'Keep working',style:'cancel'},{text:'Submit',onPress:()=>void exam.submit()}]);
  }
  const bottom=d ? <View style={[styles.bottom,{paddingHorizontal:layout.padding}]}><View style={{flexGrow:1,flexShrink:1,flexBasis:Math.max(120,110*fontScale),minWidth:0,maxWidth:'100%'}}><Button secondary icon="chevron-back-outline" label="Previous" disabled={d.index===0||exam.busy} onPress={()=>move(d.index-1)}/></View><View style={{flexGrow:1,flexShrink:1,flexBasis:Math.max(120,110*fontScale),minWidth:0,maxWidth:'100%'}}>{d.index===d.questions.length-1 ? <Button icon="checkmark-outline" label="Submit" busy={exam.busy} onPress={submit}/> : <Button icon="chevron-forward-outline" label="Next" disabled={exam.busy} onPress={()=>move(d.index+1)}/>}</View></View> : null;
  return <SafeAreaView edges={['top','left','right','bottom']} style={styles.screen}>
    <Stack.Screen options={{gestureEnabled:true}}/>
    <View style={styles.topbar}>
      <View style={[styles.leading,{minWidth:Math.min(44+72*fontScale,width-insets.left-insets.right-16)}]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Leave exam" disabled={exam.busy} onPress={openLeave} style={styles.iconButton}><Ionicons name="arrow-back" size={20} color={colors.muted}/></Pressable>
      <Text style={styles.position}>Q{q?.number??'—'}<Text style={{color:colors.muted}}> / {d?.questions.length??'—'}</Text></Text>
      </View>
      <View style={styles.topActions}>
      <View accessibilityLabel={`${Math.floor(time/60)} minutes ${time%60} seconds ${remaining===null?'elapsed':'remaining'}`} style={styles.clock}><Ionicons name="time-outline" size={16} color={remaining!==null&&remaining<=300?colors.red:colors.primary}/><Text style={[styles.clockText,remaining!==null&&remaining<=300&&{color:colors.red}]}>{Math.floor(time/60)}:{String(time%60).padStart(2,'0')}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open question palette" accessibilityState={{expanded:paletteOpen,disabled:!d}} disabled={!d} onPress={()=>setPaletteOpen(true)} style={styles.iconButton}><Ionicons name="grid-outline" size={21} color={colors.primary}/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={d?.submitIntent?'Retry final submission':'Submit exam'} accessibilityState={{disabled:!d||exam.busy}} disabled={!d||exam.busy} onPress={submit} style={[styles.iconButton,styles.finish,(!d||exam.busy)&&{opacity:.45}]}><Ionicons name="checkmark" size={21} color="#fff"/></Pressable>
      </View>
    </View>
    {d ? <View style={styles.progress}><Text style={styles.progressText}>{counts!.answered}/{counts!.all} done · {counts!.marked} flagged{Object.keys(d.pending).length?` · ${Object.keys(d.pending).length} awaiting sync`:''}</Text><Bar value={100*(d.index+1)/Math.max(1,d.questions.length)}/></View> : null}
    <ScrollView ref={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content,{padding:layout.padding,paddingBottom:24}]}>
      {exam.loading ? <Loading/> : null}
      {exam.error ? <ErrorState error={exam.error} retry={d?()=>void exam.sync():exam.retry}/> : null}
      {d&&q ? <View key={q.key} style={{gap:16}}>
        <Text accessibilityRole="header" style={styles.testTitle}>{d.title}</Text>
        <Card>
          <Text style={styles.questionMeta}>QUESTION {q.number} · {q.section||q.subject}</Text>
          {q.topic ? <Text style={styles.topic}>{q.topic}</Text> : null}
          <Text style={styles.question}>{q.question}</Text>
          {(['A','B','C','D'] as const).map(option=>{
            const text=q[`option_${option.toLowerCase()}` as 'option_a'|'option_b'|'option_c'|'option_d'];
            const selected=a?.option===option;const correct=feedback?.correct_answer===option;
            const wrong=!!feedback&&selected&&!correct;const marked=selected||correct;
            const color=correct?colors.green:wrong?colors.red:colors.primary;
            return <Pressable key={option} accessibilityRole="radio" accessibilityLabel={`${option}. ${text}${correct?', correct answer':wrong?', your incorrect answer':''}`} accessibilityState={{checked:selected,disabled:answerLocked}} disabled={answerLocked} onPress={()=>void exam.select(option)} style={[styles.option,selected&&styles.selectedOption,correct&&{borderColor:colors.green,backgroundColor:colors.greenSoft},wrong&&{borderColor:colors.red,backgroundColor:colors.redSoft}]}>
              <View style={[styles.optionLetter,marked&&{backgroundColor:color}]}><Text style={{fontSize:13,fontWeight:'700',color:marked?'#fff':colors.muted}}>{option}</Text></View><Text style={styles.optionText}>{text}</Text>{marked?<Ionicons name={wrong?'close-circle':'checkmark-circle'} color={color} size={19}/>:null}
            </Pressable>;
          })}
          <View style={s.row}><View style={{flexGrow:1,flexBasis:150}}><Button secondary icon="flag-outline" label={a?.marked?'Unflag question':'Flag for review'} disabled={locked} onPress={()=>void exam.select(a?.option??null,!a?.marked)}/></View><View style={{flexGrow:1,flexBasis:100}}><Button secondary label="Clear answer" disabled={answerLocked||!a?.option} onPress={()=>void exam.select(null)}/></View></View>
          {d.feedbackMode==='instant'&&exam.busy&&a?.option&&!d.feedback[q.key] ? <Body>Checking your answer…</Body> : null}
          {d.feedbackMode==='instant'&&d.feedback[q.key] ? <Card gold><Heading>{d.feedback[q.key].is_correct?'Correct!':'Keep learning'}</Heading><Body>Correct answer: {d.feedback[q.key].correct_answer}</Body><Body>{d.feedback[q.key].explanation||'No explanation is available for this question.'}</Body></Card> : null}
          <ReportQuestion uid={q.uid} question={q.question} source={d.kind==='mock'?'mock_exam':'practice_exam'} testId={d.testId}/>
        </Card>
        {Object.keys(d.pending).length>0 ? <Button secondary label={d.feedbackMode==='instant'?'Retry answer check':'Sync saved answers'} busy={exam.busy} onPress={()=>void exam.sync()}/> : null}
        {d.submitIntent ? <Button label="Retry final submission" busy={exam.busy} onPress={submit}/> : null}
      </View> : null}
      {layout.inlineFooter?bottom:null}
    </ScrollView>
    {!layout.inlineFooter?bottom:null}
    {paletteOpen&&d ? <QuestionPalette questions={d.questions} answers={d.answers} index={d.index} disabled={exam.busy||!!exam.exitDestination} onClose={closePalette} onJump={move}/> : null}
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background},topbar:{paddingHorizontal:8,paddingVertical:6,gap:4,flexDirection:'row',flexWrap:'wrap',alignItems:'center',backgroundColor:colors.card,borderBottomWidth:1,borderBottomColor:colors.border},leading:{flexGrow:1,maxWidth:'100%',minWidth:0,flexDirection:'row',alignItems:'center',gap:4},topActions:{maxWidth:'100%',flexDirection:'row',alignItems:'center',gap:4,marginLeft:'auto'},
  iconButton:{flexShrink:0,minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:13},position:{flex:1,minWidth:0,fontSize:12,fontWeight:'700',color:colors.ink},clock:{flexShrink:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:8,paddingVertical:7,borderRadius:11,backgroundColor:'#F6F5F3'},clockText:{flexShrink:1,fontSize:14,fontWeight:'700',color:colors.primary,fontVariant:['tabular-nums']},finish:{backgroundColor:colors.primary},
  progress:{paddingHorizontal:16,paddingTop:10,paddingBottom:4,gap:7},progressText:{fontSize:11,lineHeight:17,color:colors.muted},content:{padding:16,paddingBottom:24,gap:16,maxWidth:760,width:'100%',alignSelf:'center'},testTitle:{fontSize:13,lineHeight:21,color:colors.muted,fontWeight:'600'},questionMeta:{fontSize:11,lineHeight:18,fontWeight:'700',color:colors.muted},topic:{fontSize:12,lineHeight:19,color:colors.muted},question:{fontSize:18,lineHeight:29,fontWeight:'600',color:colors.ink},
  option:{flexDirection:'row',alignItems:'center',padding:13,gap:10,minHeight:54,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card},selectedOption:{borderColor:colors.primary,backgroundColor:colors.primarySoft},optionLetter:{minWidth:26,minHeight:26,paddingHorizontal:4,paddingVertical:2,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:'#F4F3F1'},optionText:{flex:1,minWidth:0,fontSize:15,lineHeight:24,color:colors.ink},bottom:{flexDirection:'row',flexWrap:'wrap',gap:10,paddingHorizontal:16,paddingVertical:10,borderTopWidth:1,borderTopColor:colors.border,backgroundColor:colors.card},
});
