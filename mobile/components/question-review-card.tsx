import { memo } from 'react';
import { Text, View } from 'react-native';
import { Badge, Body, Button, Heading, s } from './ui';
import { ReportQuestion } from './report-question';
import { colors } from '@/utils/theme';
import type { ReviewQuestion } from '@/utils/question-review';
import { reviewAnswerText } from '@/utils/result-summary';

export const QuestionReviewCard = memo(function QuestionReviewCard({question:q, number, expanded, onToggle, kind, testId}: {
  question:ReviewQuestion; number:number; expanded:boolean; onToggle:()=>void; kind:'practice'|'mock'; testId?:string;
}) {
  const status=q.is_skipped?'Skipped':q.is_correct?'Correct':'Wrong';
  const statusColor=q.is_skipped?colors.muted:q.is_correct?colors.green:colors.red;
  return <View style={{padding:16,gap:12,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card}}>
    <View style={s.between}><Badge label={`Q${number}`}/><Badge label={status} color={statusColor}/></View>
    <Text style={{fontSize:16,lineHeight:26,fontWeight:'600',color:colors.ink}}>{q.question}</Text>
    <View style={{padding:12,borderRadius:12,backgroundColor:q.is_correct?colors.greenSoft:'#F5F4F1',gap:4}}><Text style={{fontSize:11,lineHeight:18,fontWeight:'700',color:q.is_correct?colors.green:colors.muted}}>{q.is_correct?'Your answer · Correct':'Your answer'}</Text><Text style={{fontSize:14,lineHeight:23,color:colors.ink}}>{reviewAnswerText(q,q.user_answer)}</Text></View>
    {!q.is_correct?<View style={{padding:12,borderRadius:12,backgroundColor:colors.greenSoft,gap:4}}><Text style={{fontSize:11,lineHeight:18,fontWeight:'700',color:colors.green}}>Correct answer</Text><Text style={{fontSize:14,lineHeight:23,color:colors.ink}}>{reviewAnswerText(q,q.correct_answer)}</Text></View>:null}
    <Button secondary icon={expanded?'chevron-up-outline':'bulb-outline'} label={expanded?'Hide details':'Explanation & options'} onPress={onToggle}/>
    {expanded ? <>
    {(['A','B','C','D'] as const).map(option=>{
      const correct=q.correct_answer===option; const wrong=q.user_answer===option&&!correct;
      return <View key={option} style={{flexDirection:'row',gap:10,padding:12,borderRadius:14,borderWidth:1,borderColor:correct?colors.green:wrong?colors.red:colors.border,backgroundColor:correct?colors.greenSoft:wrong?colors.redSoft:colors.card}}>
        <Text style={{fontWeight:'800',color:correct?colors.green:wrong?colors.red:colors.muted}}>{option}</Text>
        <View style={{flex:1,gap:4}}><Text style={{fontSize:14,lineHeight:22,color:colors.ink}}>{q[`option_${option.toLowerCase()}` as 'option_a'|'option_b'|'option_c'|'option_d']}</Text>{correct ? <Text style={{fontSize:12,color:colors.green}}>Correct answer{q.user_answer===option?' · Your answer':''}</Text> : wrong ? <Text style={{fontSize:12,color:colors.red}}>Your answer</Text> : null}</View>
      </View>;
    })}
    <View style={{backgroundColor:colors.primarySoft,borderRadius:16,padding:14,gap:8}}><Heading>Explanation</Heading><Body color={colors.ink}>{q.explanation||'No explanation provided for this question.'}</Body></View>
      {q.edited_since_attempt ? <Body>This question was edited after your attempt. Your recorded score is unchanged.</Body> : null}
      <ReportQuestion uid={q.question_uid} question={q.question} source={kind==='mock'?'mock_result':'practice_result'} testId={testId}/></> : null}
  </View>;
});
