import { Chips, Heading } from './ui';
import type { EducationMedium, LearningGoal } from '@/types/auth';
export const goalItems: {value:LearningGoal;label:string}[] = [{value:'mock_test',label:'Mock tests'},{value:'practice',label:'Practice'},{value:'ai_support',label:'AI support (interest)'},{value:'other',label:'Other'}];
export function Preferences({medium, goals, setMedium, setGoals}: {medium: EducationMedium; goals: LearningGoal[]; setMedium:(m:EducationMedium)=>void;setGoals:(g:LearningGoal[])=>void}) {
  return <><Heading>Study medium</Heading><Chips items={[{value:'english',label:'English'},{value:'telugu',label:'తెలుగు'}]} selected={medium} onSelect={setMedium}/><Heading>Study goals</Heading><Chips items={goalItems} selected={goals} onSelect={g=>setGoals(goals.includes(g)?goals.filter(x=>x!==g):[...goals,g])}/></>;
}
