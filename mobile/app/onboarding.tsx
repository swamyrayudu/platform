import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Screen, Card, Button, ErrorState } from '@/components/ui';
import { Preferences } from '@/components/preferences';
import { useAuth } from '@/store/auth';
import { authService } from '@/services/auth-service';
import type { EducationMedium, LearningGoal } from '@/types/auth';
export default function Onboarding() {
  const auth=useAuth(); const [medium,setMedium]=useState<EducationMedium>('english');const [goals,setGoals]=useState<LearningGoal[]>(['practice']);
  const save=useMutation({mutationFn:()=>authService.onboarding(goals,medium),onSuccess:data=>auth.update(data.user)});
  return <Screen title="Make it your own" subtitle="Choose your medium and study goals."><Card><Preferences medium={medium} goals={goals} setMedium={setMedium} setGoals={setGoals}/></Card>{save.error&&<ErrorState error={save.error}/>}<Button label="Start learning" disabled={!goals.length} busy={save.isPending} onPress={()=>save.mutate()}/><Button secondary label="Sign out" onPress={()=>void auth.logout().catch(()=>{})}/></Screen>;
}
