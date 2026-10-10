import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/services/api-client';
import { FEEDBACK_REASONS, type FeedbackReason, type FeedbackSource } from '@/types/question-feedback';
import { Button, Card, Chips, Input, ErrorState, Body } from './ui';
export function ReportQuestion({uid,question,source,testId}: {uid?:string;question:string;source:FeedbackSource;testId?:string}) {
  const [open,setOpen]=useState(false);const [reason,setReason]=useState<FeedbackReason>('wrong_answer');const [details,setDetails]=useState('');
  const report=useMutation({mutationFn:()=>api.request('/api/dsc-sgt/questions/feedback','POST',{questionUid:uid,reason,details,source,mockTestId:testId,reportedQuestion:question})});
  if(!uid)return null;
  return <><Button secondary label="Report a question issue" onPress={()=>setOpen(x=>!x)}/>{open&&<Card><Chips items={FEEDBACK_REASONS.map(r=>({value:r.id,label:r.label}))} selected={reason} onSelect={setReason}/><Input label="Details (up to 1,000 characters)" value={details} onChangeText={t=>setDetails(t.slice(0,1000))} multiline/>{report.error&&<ErrorState error={report.error}/>} {report.isSuccess?<Body>Thank you. Your report has been recorded.</Body>:<Button label="Send report" disabled={reason==='other'&&!details.trim()} busy={report.isPending} onPress={()=>report.mutate()}/>}</Card>}</>;
}
