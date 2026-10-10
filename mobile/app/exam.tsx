import { useEffect, useState } from 'react';
import { Alert, BackHandler, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useKeepAwake } from 'expo-keep-awake';
import { Screen, Card, Body, Heading, Button, ErrorState, Loading, Bar, Chips, s } from '@/components/ui';
import { useExam } from '@/hooks/use-exam';
import type { ExamKind } from '@/store/exam';
import { colors } from '@/utils/theme';
import type { SelectedOption } from '@/types/mock-tests';
import { ReportQuestion } from '@/components/report-question';
export default function Exam() {
  useKeepAwake(); const params=useLocalSearchParams<{kind:ExamKind;id:string}>();const exam=useExam(params.kind==='mock'?'mock':'practice',params.id);
  const [filter,setFilter]=useState<'all'|'unanswered'|'marked'>('all');
  usePreventRemove(!!exam.draft&&!exam.busy,()=>Alert.alert('Exam in progress','Use Save & leave to preserve your exam.'));
  useEffect(()=>{const listener=BackHandler.addEventListener('hardwareBackPress',()=>{Alert.alert('Leave this exam?','Your answers will be kept.',[{text:'Stay',style:'cancel'},{text:'Save & leave',onPress:()=>void exam.leave()}]);return true;});return()=>listener.remove();},[exam]);
  const d=exam.draft; const q=d?.questions[d.index];const a=q?d?.answers[q.key]:undefined;
  const remaining=d&&d.duration>0?Math.max(0,d.duration-d.elapsed):null;
  const time=remaining??d?.elapsed??0;
  const locked=!!d?.submitIntent||remaining===0||exam.busy;
  const answerLocked=locked||!!(q&&d?.feedbackMode==='instant'&&d.feedback[q.key]);
  return <Screen title={d?.title||'Loading exam'} subtitle={remaining===null?'Practice at your own pace':`${Math.floor(time/60)}:${String(time%60).padStart(2,'0')} remaining`}>
    {exam.loading&&<Loading/>}{!!exam.error&&<ErrorState error={exam.error} retry={d?()=>void exam.sync():exam.retry}/>}
    {d&&q&&<>
      <Body>{Object.values(d.answers).filter(x=>x.option).length}/{d.questions.length} answered · {Object.keys(d.pending).length} awaiting sync</Body><Bar value={100*(d.index+1)/d.questions.length}/>
      <Card><Body>Question {q.number} · {q.section||q.subject} · {q.topic}</Body><Text style={{fontSize:20,lineHeight:30,fontWeight:'600',color:colors.ink}}>{q.question}</Text>
        {(['A','B','C','D'] as const).map(option=><Pressable key={option} accessibilityRole="radio" accessibilityState={{checked:a?.option===option,disabled:answerLocked}} disabled={answerLocked} onPress={()=>void exam.select(option as SelectedOption)} style={[s.chip,{padding:16,flexDirection:'row',gap:12},a?.option===option&&s.chipActive]}><Text style={{fontWeight:'800',color:colors.gold}}>{option}</Text><Text style={{flex:1,fontSize:17,lineHeight:25,color:colors.ink}}>{q[`option_${option.toLowerCase()}` as 'option_a'|'option_b'|'option_c'|'option_d']}</Text></Pressable>)}
        <Button secondary label={a?.marked?'Unmark review':'Mark for review'} disabled={locked} onPress={()=>void exam.select(a?.option??null,!a?.marked)}/><Button secondary label="Clear answer" disabled={answerLocked||!a?.option} onPress={()=>void exam.select(null)}/>
        {d.feedbackMode==='instant'&&<Button label="Check answer" busy={exam.busy} disabled={!a?.option||answerLocked} onPress={()=>void exam.sync()}/>}
        {d.feedbackMode==='instant'&&d.feedback[q.key]&&<Card gold><Heading>{d.feedback[q.key].is_correct?'Correct!':'Keep learning'}</Heading><Body>Correct answer: {d.feedback[q.key].correct_answer}</Body><Body>{d.feedback[q.key].explanation||'No explanation is available for this question.'}</Body></Card>}
        <ReportQuestion uid={q.uid} question={q.question} source={d.kind==='mock'?'mock_exam':'practice_exam'} testId={d.testId}/>
      </Card>
      <View style={s.row}><View style={{flex:1}}><Button secondary label="Previous" disabled={d.index===0||exam.busy} onPress={()=>void exam.move(d.index-1)}/></View><View style={{flex:1}}><Button label="Next" disabled={d.index===d.questions.length-1||exam.busy} onPress={()=>void exam.move(d.index+1)}/></View></View>
      <Card><Heading>Question navigator</Heading><Chips items={[{value:'all',label:'All'},{value:'unanswered',label:'Unanswered'},{value:'marked',label:'For review'}]} selected={filter} onSelect={setFilter}/><View style={s.row}>{d.questions.filter(item=>filter==='all'||filter==='marked'&&d.answers[item.key]?.marked||filter==='unanswered'&&!d.answers[item.key]?.option).map(item=><Pressable accessibilityRole="button" accessibilityLabel={`Question ${item.number}, ${d.answers[item.key]?.marked?'marked, ':''}${d.answers[item.key]?.option?'answered':'unanswered'}`} key={item.key} onPress={()=>void exam.move(d.questions.findIndex(x=>x.key===item.key))} style={[s.chip,{backgroundColor:d.answers[item.key]?.marked?'#EDE5F9':d.answers[item.key]?.option?'#E8F4EC':'#fff'},item.key===q.key&&{borderColor:colors.gold,borderWidth:2}]}><Text>{item.number}</Text></Pressable>)}</View><Body>Green: answered · Purple: for review</Body></Card>
      {Object.keys(d.pending).length>0&&<Button secondary label="Sync saved answers" busy={exam.busy} onPress={()=>void exam.sync()}/>}
      <Button label={d.submitIntent?'Retry final submission':'Submit exam'} busy={exam.busy} onPress={()=>d.submitIntent?void exam.submit():Alert.alert('Submit your exam?',`${d.questions.length-Object.values(d.answers).filter(x=>x.option).length} unanswered questions. Results are scored by the server.`,[{text:'Keep working',style:'cancel'},{text:'Submit',onPress:()=>void exam.submit()}])}/>
      <Button secondary label="Save & leave" busy={exam.busy} onPress={()=>void exam.leave()}/><Button danger label="End and leave" disabled={exam.busy||d.submitIntent} onPress={()=>Alert.alert('End this session?','This uses the website’s existing end-session rules. Free practice will consume your trial.',[{text:'Stay',style:'cancel'},{text:'End session',style:'destructive',onPress:()=>void exam.leave(true)}])}/>
    </>}
  </Screen>;
}
