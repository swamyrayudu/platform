import { memo } from 'react';
import { Text, View } from 'react-native';
import { Badge, Body, Button, Card, Heading, s } from './ui';
import { ReportQuestion } from './report-question';
import { colors } from '@/utils/theme';
import type { ReviewQuestion } from '@/utils/question-review';

export const QuestionReviewCard = memo(function QuestionReviewCard({question:q, number, expanded, onToggle, kind, testId}: {
  question:ReviewQuestion; number:number; expanded:boolean; onToggle:()=>void; kind:'practice'|'mock'; testId?:string;
}) {
  const status=q.is_skipped?'Unanswered':q.is_correct?'Correct':'Incorrect';
  const statusColor=q.is_skipped?colors.muted:q.is_correct?colors.green:colors.red;
  return <Card>
    <View style={s.between}><Badge label={`QUESTION ${number}`}/><Badge label={status} color={statusColor}/></View>
    <Text style={{fontSize:17,lineHeight:27,fontWeight:'600',color:colors.ink}}>{q.question}</Text>
    {(['A','B','C','D'] as const).map(option=>{
      const correct=q.correct_answer===option; const wrong=q.user_answer===option&&!correct;
      return <View key={option} style={{flexDirection:'row',gap:10,padding:12,borderRadius:14,borderWidth:1,borderColor:correct?colors.green:wrong?colors.red:colors.border,backgroundColor:correct?colors.greenSoft:wrong?colors.redSoft:colors.card}}>
        <Text style={{fontWeight:'800',color:correct?colors.green:wrong?colors.red:colors.muted}}>{option}</Text>
        <View style={{flex:1,gap:4}}><Text style={{fontSize:14,lineHeight:22,color:colors.ink}}>{q[`option_${option.toLowerCase()}` as 'option_a'|'option_b'|'option_c'|'option_d']}</Text>{correct ? <Text style={{fontSize:12,color:colors.green}}>Correct answer{q.user_answer===option?' · Your answer':''}</Text> : wrong ? <Text style={{fontSize:12,color:colors.red}}>Your answer</Text> : null}</View>
      </View>;
    })}
    <Body>Your answer: {q.user_answer||'Unanswered'} · Correct answer: {q.correct_answer}</Body>
    <Button secondary icon={expanded?'chevron-up-outline':'bulb-outline'} label={expanded?'Hide explanation':'Read explanation'} onPress={onToggle}/>
    {expanded ? <><View style={{backgroundColor:colors.primarySoft,borderRadius:16,padding:16,gap:8}}><Heading>Understand the concept</Heading><Body color={colors.ink}>{q.explanation||'No explanation provided for this question.'}</Body></View>
      {q.edited_since_attempt ? <Body>This question was edited after your attempt. Your recorded score is unchanged.</Body> : null}
      <ReportQuestion uid={q.question_uid} question={q.question} source={kind==='mock'?'mock_result':'practice_result'} testId={testId}/></> : null}
  </Card>;
});
