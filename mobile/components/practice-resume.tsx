import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Card, Heading, Body, Button } from './ui';
import { vault } from '@/services/vault';
import { examDrafts } from '@/services/exam-drafts';
import { practiceService } from '@/services/question-service';
import type { ExamDraft } from '@/store/exam';

export function PracticeResume({userId}:{userId?:string}) {
  const [draft,setDraft]=useState<ExamDraft|null>(null);
  useFocusEffect(useCallback(()=>{
    let alive=true;
    void (async()=>{
      const active=await vault.read<ExamDraft>('active-exam');
      if(!active||active.kind!=='practice'||active.userId!==userId){if(alive)setDraft(null);return;}
      const {saved,state}=await examDrafts.load(active.userId,'practice',active.id,async()=>(await practiceService.get(active.id)).session);
      if(alive)setDraft(!state||state.status==='in_progress'?saved:null);
    })().catch(()=>{if(alive)setDraft(null);});
    return()=>{alive=false;};
  },[userId]));
  if(!draft)return null;
  return <Card><Heading>Saved practice</Heading><Body>{draft.title} · Question {draft.index+1}/{draft.questions.length}</Body><Button icon="play-outline" label="Resume practice" onPress={()=>router.push({pathname:'/exam',params:{kind:'practice',id:draft.id}})}/></Card>;
}
