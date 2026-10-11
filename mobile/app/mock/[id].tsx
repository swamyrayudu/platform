import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Screen, Card, Heading, Body, Button, ErrorState, Loading } from '@/components/ui';
import { examService } from '@/services/exam-service';
export default function MockInstructions() {
  const {id}=useLocalSearchParams<{id:string}>();const test=useQuery({queryKey:['mock',id],queryFn:()=>examService.metadata(id)});
  const start=useMutation({mutationFn:()=>examService.start(id),onSuccess:data=>router.push({pathname:'/exam',params:{kind:'mock',id:data.attempt_id}})});
  return <Screen title={test.data?.test.title||'Exam instructions'}>
    {test.isLoading&&<Loading/>}{test.error&&<ErrorState error={test.error} retry={()=>void test.refetch()}/>}{test.data&&<Card><Heading>Before you begin</Heading><Body>{test.data.test.description}</Body><Body>{test.data.test.total_questions} questions · {test.data.test.duration_minutes} minutes · {test.data.test.total_marks} marks</Body><Body>{test.data.test.marks_per_question} marks per question · Negative marking: {test.data.test.negative_marks}</Body><Body>Choose one option. You can clear an answer, mark it for review, and jump between questions. Unanswered questions stay unanswered.</Body><Body>Your answers are saved securely on this device and sent to the server. Submit when finished to see your score and explanations.</Body><Body>Save & leave pauses a mock paper. Returning continues the remaining time recorded for your attempt.</Body><Button label="Start / resume paper" busy={start.isPending} onPress={()=>start.mutate()}/></Card>}
    {start.error&&<ErrorState error={start.error}/>}<Button secondary label="Subscription access" onPress={()=>router.push('/subscription')}/><Button secondary label="Back to library" onPress={()=>router.replace('/mocks')}/>
  </Screen>;
}
