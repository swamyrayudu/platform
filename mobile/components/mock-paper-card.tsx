import { memo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Body, Button, Card, Heading, s } from './ui';
import type { MockTestListItem } from '@/types/mock-tests';
import { colors } from '@/utils/theme';

export const MockPaperCard = memo(function MockPaperCard({test}: {test:MockTestListItem}) {
  const completed = test.progress_status === 'completed';
  const ongoing = test.progress_status === 'in_progress';
  return <Card>
    <View style={s.between}><Badge label={test.module_number ? `MODULE ${test.module_number}` : test.category.replaceAll('_',' ').toUpperCase()}/><Badge label={test.is_free ? 'FREE' : 'DSC PRO'} color={test.is_free ? colors.green : colors.gold}/></View>
    <Heading>{test.title}</Heading>{test.description ? <Body>{test.description}</Body> : null}
    <View style={s.row}><Badge label={`${test.total_questions} questions`}/><Badge label={`${test.duration_minutes} min`}/><Badge label={`${test.total_marks} marks`}/></View>
    <Body color={completed ? colors.green : colors.muted}>{completed ? 'Completed' : ongoing ? 'Your exam is in progress' : 'Ready when you are'}</Body>
    {test.is_sequence_locked ? <Body>Complete the preceding module to unlock this paper.</Body> : <Button icon={completed ? 'checkmark-circle-outline' : ongoing ? 'play-outline' : 'arrow-forward-outline'} secondary={completed} label={completed ? 'View results' : ongoing ? 'Continue exam' : 'View instructions'} onPress={()=>test.user_attempt?.status==='submitted' ? router.push({pathname:'/result',params:{kind:'mock',id:test.user_attempt.attempt_id}}) : router.push({pathname:'/mock/[id]',params:{id:test.id}})}/>}
  </Card>;
});
