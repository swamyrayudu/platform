import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useKeepAwake } from 'expo-keep-awake';
import { Card, Body, Heading, Button, ErrorState, Loading, Bar } from '@/components/ui';
import { QuestionPalette } from '@/components/question-palette';
import { AlertDialog } from '@/components/alert-dialog';
import { useExam } from '@/hooks/use-exam';
import type { ExamKind } from '@/store/exam';
import { colors } from '@/utils/theme';
import { paletteCounts } from '@/utils/question-palette';
import { ReportQuestion } from '@/components/report-question';
import { examControlLayout, pageLayout } from '@/utils/layout';

export default function Exam() {
  useKeepAwake();
  const {width,height,fontScale}=useWindowDimensions();const insets=useSafeAreaInsets();
  const layout=pageLayout(width-insets.left-insets.right,height-insets.top-insets.bottom,fontScale);
  const controls=examControlLayout(width-insets.left-insets.right,fontScale);
  const params=useLocalSearchParams<{kind:ExamKind;id:string}>();
  const exam=useExam(params.kind==='mock'?'mock':'practice',params.id);
  const {busy,exitDestination,leave:leaveExam,move:moveQuestion,pauseForConfirmation,endConfirmation}=exam;
  const [paletteOpen,setPaletteOpen]=useState(false);
  const [confirmation,setConfirmation]=useState<'leave'|'submit'|null>(null);
  const confirmationRef=useRef<'leave'|'submit'|null>(null);
  const scroll=useRef<ScrollView>(null);
  const hasDraft=!!exam.draft;
  const closePalette=useCallback(()=>setPaletteOpen(false),[]);
  const openLeave=useCallback(()=>{
    if(paletteOpen){closePalette();return;}
    if(busy||exitDestination||confirmationRef.current)return;
    if(!hasDraft){if(router.canGoBack())router.back();else router.replace(params.kind==='mock'?'/(tabs)/mocks':'/(tabs)/practice');return;}
    if(pauseForConfirmation()){confirmationRef.current='leave';setConfirmation('leave');}
  },[paletteOpen,closePalette,busy,exitDestination,hasDraft,params.kind,pauseForConfirmation]);
  const cancelConfirmation=useCallback(()=>{
    if(!confirmationRef.current)return;
    confirmationRef.current=null;setConfirmation(null);endConfirmation();
  },[endConfirmation]);
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
  const locked=!!d?.submitIntent||remaining===0||exam.busy||!!exam.exitDestination||confirmation!==null;
  const answerLocked=locked||!!(q&&d?.feedbackMode==='instant'&&d.feedback[q.key]);
  const feedback=q&&d?.feedbackMode==='instant'?d.feedback[q.key]:undefined;
  const questions=d?.questions,answers=d?.answers;
  const counts=useMemo(()=>questions&&answers?paletteCounts(questions,answers):undefined,[questions,answers]);
  const move=useCallback((index:number)=>{
    if(busy||exitDestination||confirmationRef.current)return;
    setPaletteOpen(false);void moveQuestion(index);
    scroll.current?.scrollTo({y:0,animated:false});
  },[busy,exitDestination,moveQuestion]);
  function submit() {
    if(!d||busy||exitDestination||confirmationRef.current)return;
    if(d.submitIntent){void exam.submit();return;}
    if(pauseForConfirmation()){confirmationRef.current='submit';setConfirmation('submit');}
  }
  function confirmAction() {
    const action=confirmationRef.current;
    if(!action||busy||exitDestination)return;
    confirmationRef.current=null;setConfirmation(null);endConfirmation(false);
    if(action==='leave')void leaveExam();else void exam.submit();
  }
  const bottom=d ? <View style={styles.bottom}><View style={[styles.navigation,{paddingHorizontal:layout.inlineFooter?0:layout.padding,flexDirection:controls.stackedNavigation?'column':'row'}]}>
    <View style={[styles.navigationButton,controls.stackedNavigation&&styles.stackedControl]}><Button secondary icon="chevron-back-outline" label="Previous" disabled={d.index===0||exam.busy} onPress={()=>move(d.index-1)}/></View>
    <View style={[styles.navigationButton,controls.stackedNavigation&&styles.stackedControl]}>{d.index===d.questions.length-1 ? <Button icon="checkmark-outline" label="Submit" busy={exam.busy} onPress={submit}/> : <Button icon="chevron-forward-outline" label="Next" disabled={exam.busy} onPress={()=>move(d.index+1)}/>}</View>
  </View></View> : null;
  return <SafeAreaView edges={['top','left','right','bottom']} style={styles.screen}>
    <Stack.Screen options={{gestureEnabled:true}}/>
    <View style={styles.header}><View style={[styles.topbar,controls.stackedHeader&&styles.stackedHeader]}>
      <View style={[styles.leading,controls.stackedHeader&&{flexGrow:0,flexShrink:0,flexBasis:'auto'}]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Leave exam" accessibilityState={{disabled:exam.busy}} disabled={exam.busy} onPress={openLeave} style={({pressed})=>[styles.iconButton,pressed&&styles.pressed]}><Ionicons name="arrow-back" size={21} color={colors.primary}/></Pressable>
      <Text style={styles.position}>Q{q?.number??'—'}<Text style={{color:colors.muted}}> / {d?.questions.length??'—'}</Text></Text>
      </View>
      <View style={[styles.topActions,controls.stackedHeader&&{width:'100%'}]}>
      <View accessibilityLabel={`${Math.floor(time/60)} minutes ${time%60} seconds ${remaining===null?'elapsed':'remaining'}`} style={styles.clock}><Ionicons name="time-outline" size={16} color={remaining!==null&&remaining<=300?colors.red:colors.primary}/><Text style={[styles.clockText,remaining!==null&&remaining<=300&&{color:colors.red}]}>{Math.floor(time/60)}:{String(time%60).padStart(2,'0')}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open question palette" accessibilityState={{expanded:paletteOpen,disabled:!d}} disabled={!d} onPress={()=>setPaletteOpen(true)} style={({pressed})=>[styles.iconButton,styles.paletteButton,pressed&&styles.pressed]}><Ionicons name="grid-outline" size={21} color={colors.primary}/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={d?.submitIntent?'Retry final submission':'Submit exam'} accessibilityState={{disabled:!d||exam.busy}} disabled={!d||exam.busy} onPress={submit} style={[styles.iconButton,styles.finish,(!d||exam.busy)&&{opacity:.45}]}><Ionicons name="checkmark" size={21} color="#fff"/></Pressable>
      </View>
    </View></View>
    <KeyboardAvoidingView style={styles.body} behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScrollView ref={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.content,{padding:layout.padding,paddingBottom:20}]}>
      {exam.loading ? <Loading/> : null}
      {d?.kind==='practice'&&d.submitIntent&&exam.busy ? <Body>Finishing practice…</Body> : null}
      {exam.error ? <ErrorState error={exam.error} retry={d?()=>void (d.kind==='practice'&&d.submitIntent?leaveExam():exam.sync()):exam.retry}/> : null}
      {d&&q ? <View key={q.key} style={styles.questionContent}>
        <View style={styles.progress}><Text style={styles.progressText}>{counts!.answered}/{counts!.all} answered{Object.keys(d.pending).length?` · ${Object.keys(d.pending).length} syncing`:''}</Text><Bar value={100*counts!.answered/Math.max(1,d.questions.length)}/></View>
        <Heading style={styles.testTitle}>{d.title}</Heading>
        <View style={[styles.questionCard,{padding:controls.cardPadding}]}>
          <View style={styles.metadata}><Text style={styles.questionMeta}>{q.section||q.subject}</Text>{q.topic ? <Text style={styles.topic}>{q.topic}</Text> : null}</View>
          <Text style={styles.question}>{q.question}</Text>
          {(['A','B','C','D'] as const).map(option=>{
            const text=q[`option_${option.toLowerCase()}` as 'option_a'|'option_b'|'option_c'|'option_d'];
            const selected=a?.option===option;const correct=feedback?.correct_answer===option;
            const wrong=!!feedback&&selected&&!correct;const marked=selected||correct;
            const color=correct?colors.green:wrong?colors.red:colors.primary;
            return <Pressable key={option} accessibilityRole="radio" accessibilityLabel={`${option}. ${text}${correct?', correct answer':wrong?', your incorrect answer':''}`} accessibilityState={{checked:selected,disabled:answerLocked}} disabled={answerLocked} onPress={()=>void exam.select(option)} style={({pressed})=>[styles.option,selected&&styles.selectedOption,correct&&{borderColor:colors.green,backgroundColor:colors.greenSoft},wrong&&{borderColor:colors.red,backgroundColor:colors.redSoft},pressed&&styles.pressed]}>
              <View style={[styles.optionLetter,marked&&{backgroundColor:color}]}><Text style={{fontSize:13,fontWeight:'700',color:marked?'#fff':colors.muted}}>{option}</Text></View><Text style={styles.optionText}>{text}</Text>{marked?<Ionicons name={wrong?'close-circle':'checkmark-circle'} color={color} size={19}/>:null}
            </Pressable>;
          })}
          <View style={[styles.questionActions,{flexDirection:controls.stackedActions?'column':'row'}]}>
            <Pressable accessibilityRole="button" accessibilityLabel={a?.marked?'Remove review flag':'Flag question for review'} accessibilityState={{selected:!!a?.marked,disabled:locked}} disabled={locked} onPress={()=>void exam.select(a?.option??null,!a?.marked)} style={({pressed})=>[styles.questionAction,controls.stackedActions&&styles.stackedControl,a?.marked&&styles.reviewed,locked&&styles.disabled,pressed&&styles.pressed]}>
              <Ionicons name={a?.marked?'flag':'flag-outline'} size={17} color={a?.marked?colors.gold:colors.primary}/><Text style={[styles.actionText,a?.marked&&{color:colors.gold}]}>{a?.marked?'Marked':'Review'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Clear answer" accessibilityState={{disabled:answerLocked||!a?.option}} disabled={answerLocked||!a?.option} onPress={()=>void exam.select(null)} style={({pressed})=>[styles.questionAction,controls.stackedActions&&styles.stackedControl,(answerLocked||!a?.option)&&styles.disabled,pressed&&styles.pressed]}>
              <Ionicons name="refresh-outline" size={17} color={colors.muted}/><Text style={[styles.actionText,{color:colors.muted}]}>Clear</Text>
            </Pressable>
          </View>
          {d.feedbackMode==='instant'&&!d.submitIntent&&exam.busy&&a?.option&&!d.feedback[q.key] ? <Body>Checking your answer…</Body> : null}
          {d.feedbackMode==='instant'&&d.feedback[q.key] ? <Card gold><Heading>{d.feedback[q.key].is_correct?'Correct!':'Keep learning'}</Heading><Body>Correct answer: {d.feedback[q.key].correct_answer}</Body><Body>{d.feedback[q.key].explanation||'No explanation is available for this question.'}</Body></Card> : null}
        </View>
        <ReportQuestion uid={q.uid} question={q.question} source={d.kind==='mock'?'mock_exam':'practice_exam'} testId={d.testId}/>
        {Object.keys(d.pending).length>0 ? <Button secondary label={d.feedbackMode==='instant'?'Retry answer check':'Sync saved answers'} busy={exam.busy} onPress={()=>void exam.sync()}/> : null}
        {d.submitIntent ? <Button label="Retry final submission" busy={exam.busy} onPress={submit}/> : null}
      </View> : null}
      {layout.inlineFooter?bottom:null}
    </ScrollView>
    {!layout.inlineFooter?bottom:null}
    </KeyboardAvoidingView>
    {paletteOpen&&d ? <QuestionPalette questions={d.questions} answers={d.answers} index={d.index} disabled={exam.busy||!!exam.exitDestination} onClose={closePalette} onJump={move}/> : null}
    {confirmation ? <AlertDialog
      title={confirmation==='leave'?(d?.kind==='practice'?'Finish practice?':'Save and leave?'):'Submit test?'}
      notice="Timer paused"
      description={confirmation==='leave'?(d?.kind==='practice'?'Finish and score your answers, then return to Practice. This practice will be completed.':'Save your answers and return to Mock Tests. Resume later.'):`${counts?.answered??0} of ${counts?.all??0} answered · ${counts?.unanswered??0} left. Finish and view results?`}
      icon={confirmation==='leave'&&d?.kind==='mock'?'pause-outline':'checkmark-done-outline'}
      cancelLabel={confirmation==='leave'?'Stay':'Keep working'}
      confirmLabel={confirmation==='leave'?(d?.kind==='practice'?'Finish & leave':'Stop timer & save'):'Submit'}
      onCancel={cancelConfirmation} onConfirm={confirmAction}/>:null}
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background},body:{flex:1},header:{flexShrink:0,backgroundColor:colors.card,borderBottomWidth:1,borderBottomColor:colors.border},
  topbar:{width:'100%',maxWidth:760,alignSelf:'center',paddingHorizontal:8,paddingVertical:6,gap:8,flexDirection:'row',alignItems:'center'},stackedHeader:{flexDirection:'column',alignItems:'stretch',gap:4},
  leading:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:4},topActions:{minWidth:0,flexShrink:1,flexDirection:'row',alignItems:'center',gap:4},
  iconButton:{flexShrink:0,width:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:12},position:{flex:1,minWidth:0,fontSize:12,lineHeight:19,fontWeight:'700',color:colors.ink},
  clock:{flexShrink:1,minWidth:0,minHeight:44,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:8,paddingVertical:8,borderRadius:12,backgroundColor:'#F6F5F3'},clockText:{flexShrink:1,fontSize:14,lineHeight:21,fontWeight:'700',color:colors.primary,fontVariant:['tabular-nums']},finish:{backgroundColor:colors.primary},paletteButton:{backgroundColor:colors.primarySoft},
  progress:{gap:7},progressText:{fontSize:12,lineHeight:19,color:colors.muted},content:{padding:16,paddingBottom:20,gap:12,maxWidth:760,width:'100%',alignSelf:'center'},questionContent:{gap:12},testTitle:{},
  questionCard:{minWidth:0,gap:12,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card},metadata:{gap:3},questionMeta:{fontSize:11,lineHeight:18,fontWeight:'700',color:colors.primary},topic:{fontSize:12,lineHeight:19,color:colors.muted},question:{fontSize:18,lineHeight:29,fontWeight:'600',color:colors.ink},
  option:{flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingVertical:12,gap:9,minHeight:52,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card},selectedOption:{borderColor:colors.primary,backgroundColor:colors.primarySoft},optionLetter:{flexShrink:0,minWidth:28,minHeight:28,paddingHorizontal:5,paddingVertical:3,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:'#F4F3F1'},optionText:{flex:1,minWidth:0,fontSize:15,lineHeight:24,color:colors.ink},
  questionActions:{gap:8,paddingTop:2},questionAction:{flexGrow:1,flexBasis:0,minWidth:0,minHeight:44,paddingHorizontal:10,paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,borderRadius:12,borderWidth:1,borderColor:colors.border},actionText:{flexShrink:1,minWidth:0,fontSize:13,lineHeight:20,fontWeight:'600',color:colors.primary},reviewed:{backgroundColor:'#FCF4E6',borderColor:'#E4CFA9'},disabled:{opacity:.45},pressed:{opacity:.7},
  bottom:{flexShrink:0,borderTopWidth:1,borderTopColor:colors.border,backgroundColor:colors.card},navigation:{width:'100%',maxWidth:760,alignSelf:'center',gap:10,paddingVertical:10},navigationButton:{flexGrow:1,flexBasis:0,minWidth:0},stackedControl:{flexGrow:0,flexBasis:'auto'},
});
