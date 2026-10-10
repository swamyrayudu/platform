import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Screen, Card, Heading, Body, Stats, Button, Chips, Loading, ErrorState, Bar } from '@/components/ui';
import { examService } from '@/services/exam-service';
import { practiceService } from '@/services/question-service';
import { ReportQuestion } from '@/components/report-question';
import { colors } from '@/utils/theme';
import { useAuth } from '@/store/auth';
import { launchPractice } from '@/services/session-launch';
export default function Result() {
  const {user}=useAuth();
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>(); const [filter, setFilter] = useState('all'); const [page, setPage] = useState(0); const [leaderboard, setLeaderboard] = useState(false);
  const practice = useQuery({ queryKey: ['practice-result', id], queryFn: () => practiceService.results(id), enabled: kind === 'practice' });
  const mock = useQuery({ queryKey: ['mock-result', id], queryFn: () => examService.result(id), enabled: kind === 'mock' });
  const next = useQuery({ queryKey: ['next', mock.data?.result.mock_test_id], queryFn: () => examService.next(mock.data!.result.mock_test_id), enabled: !!mock.data });
  const ranks = useQuery({ queryKey: ['leaderboard', mock.data?.result.mock_test_id], queryFn: () => examService.leaderboard(mock.data!.result.mock_test_id), enabled: leaderboard && !!mock.data });
  const retry = useMutation({ mutationFn: (topic?: string) => launchPractice(user!.id,()=>practiceService.retry({ fromSessionId: id, topic })), onSuccess: data => router.replace({ pathname: '/exam', params: { kind: 'practice', id: data.session.id } }) });
  const result = practice.data?.results || mock.data?.result; const active = kind === 'mock' ? mock : practice;
  const review = result?.questions_review.filter(q => filter === 'all' || filter === 'incorrect' && !q.is_correct && !q.is_skipped || filter === 'skipped' && q.is_skipped || filter === 'marked' && q.is_marked) || [];
  return <Screen title="Your results" subtitle="Review every answer. Keep moving forward." refreshing={active.isRefetching} onRefresh={() => void active.refetch()}>
    {active.isLoading && <Loading />}{active.error && <ErrorState error={active.error} retry={() => void active.refetch()} />} {result && <>
      <Card gold><Heading>{mock.data?.result.test_title || practice.data?.results.subject}</Heading><Stats items={[{ label: 'Score', value: `${result.score}/${mock.data?.result.total_marks ?? result.total_questions}` }, { label: 'Accuracy', value: `${mock.data?.result.percentage ?? practice.data?.results.accuracy_pct}%` }, { label: 'Correct', value: result.correct_count }, { label: 'Incorrect', value: result.incorrect_count }, { label: 'Unanswered', value: mock.data?.result.unanswered_count ?? practice.data?.results.skipped_count ?? 0 }, { label: 'Time', value: `${Math.floor(result.total_time_seconds / 60)} min ${result.total_time_seconds % 60}s` }]} />{mock.data && <Body>Rank: {mock.data.result.rank ?? 'calculating'} · Percentile: {mock.data.result.percentile ?? 'calculating'}</Body>}</Card>
      <Card><Heading>{kind === 'mock' ? 'Section' : 'Topic'} performance</Heading>{mock.data?.result.section_scores.map(x => <Body key={x.section_id}>{x.section_name} · {x.score}/{x.total_marks} · {x.correct}/{x.total} correct</Body>)}{practice.data?.results.topic_breakdown.map(x => <Card key={x.topic}><Heading>{x.topic}</Heading><Body>{x.correct}/{x.total_questions} · {x.accuracy_pct}% · {x.is_weak ? 'Needs practice' : x.is_mastered ? 'Mastered' : 'Progressing'}</Body><Bar value={x.accuracy_pct} /></Card>)}</Card>
      {practice.data && <><Button label="Retry incorrect questions" busy={retry.isPending} onPress={() => retry.mutate(undefined)} />{practice.data.results.weak_recommendations.map(r => <Button key={r.topic} secondary label={r.action_label} onPress={() => retry.mutate(r.topic)} />)}{retry.error && <ErrorState error={retry.error} />}</>}
      {mock.data && <><Button secondary label="View leaderboard" onPress={() => setLeaderboard(x => !x)} />{leaderboard && <Card><Heading>Paper leaderboard</Heading>{ranks.isLoading && <Loading />}{ranks.error && <ErrorState error={ranks.error} retry={() => void ranks.refetch()} />} {ranks.data?.leaderboard.length === 0 && <Body>No ranked attempts yet.</Body>}{ranks.data?.leaderboard.map(r => <Body key={r.attempt_id} color={r.is_current_user ? colors.gold : undefined}>#{r.rank} {r.user_name || 'Learner'} · {r.score} · {r.percentage}% {r.is_current_user ? '(you)' : ''}</Body>)}</Card>}{next.data?.next_module && <Button label="Next module" onPress={() => router.replace({ pathname: '/mock/[id]', params: { id: next.data!.next_module!.id } })} />}</>}
      <Heading>Answer review</Heading><Chips items={[{ value: 'all', label: 'All' }, { value: 'incorrect', label: 'Incorrect' }, { value: 'skipped', label: 'Unanswered' }, { value: 'marked', label: 'For review' }]} selected={filter} onSelect={x => { setFilter(x); setPage(0); }} />
      {!review.length && <Body>No questions match this filter.</Body>}{review.slice(page * 10, page * 10 + 10).map((q, index) => <Card key={`${q.question_id}-${index}`}><Heading>Q{page * 10 + index + 1} · {q.is_skipped ? 'Unanswered' : q.is_correct ? 'Correct' : 'Incorrect'}</Heading><Body color={colors.ink}>{q.question}</Body>{(['A', 'B', 'C', 'D'] as const).map(o => <Body key={o}>{o}. {q[`option_${o.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d']}</Body>)}<Body>Your answer: {q.user_answer || '—'} · Correct answer: {q.correct_answer}</Body><Body>{q.explanation || 'No explanation provided.'}</Body>{'edited_since_attempt' in q && q.edited_since_attempt && <Body>This question was edited after your attempt. Your recorded score is unchanged.</Body>}<ReportQuestion uid={q.question_uid} question={q.question} source={kind === 'mock' ? 'mock_result' : 'practice_result'} testId={mock.data?.result.mock_test_id} /></Card>)}
      <Button secondary label="Previous review page" disabled={page === 0} onPress={() => setPage(x => x - 1)} /><Button secondary label="Next review page" disabled={(page + 1) * 10 >= review.length} onPress={() => setPage(x => x + 1)} />
    </>}<Button label="Back to dashboard" onPress={() => router.replace('/')} />
  </Screen>;
}
