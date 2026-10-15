// My Tests: tests the candidate makes with an AI tool (see /create-test),
// stored on the website and taken here (see /my-test/[id]).
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListScreen, Loading, ErrorState, Button, Card, Heading, Body } from '@/components/ui';
import { BackHeader } from '@/components/back-header';
import { AlertDialog } from '@/components/alert-dialog';
import { myTestsService } from '@/services/learning-service';
import { ApiError } from '@/services/api-client';
import { colors, subjectStyle } from '@/utils/theme';
import type { MyTestListItem } from '@/types/learning';

export default function MyTests() {
  const cache = useQueryClient();
  const list = useQuery({queryKey: ['my-tests'], queryFn: myTestsService.list});
  const [deleting, setDeleting] = useState<MyTestListItem | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => myTestsService.remove(id),
    onSuccess: () => { setDeleting(null); void cache.invalidateQueries({queryKey: ['my-tests']}); },
  });
  const {refetch} = list;
  useFocusEffect(useCallback(() => { void refetch({cancelRefetch: false}); }, [refetch]));

  const notSetUp = list.error instanceof ApiError && list.error.code === 'NOT_SET_UP';
  const tests = list.data?.tests ?? [];
  const limit = list.data?.limit ?? 0;
  const full = !!list.data && tests.length >= limit;

  const header = <View style={{gap: 12}}>
    {list.isPending ? <Loading/> : null}
    {notSetUp ? <Card><Heading>Coming soon</Heading><Body>My Tests is being set up. Check back shortly.</Body></Card> : null}
    {list.error && !notSetUp ? <ErrorState error={list.error} retry={() => void list.refetch()}/> : null}
    {list.data ? <View style={styles.summary}>
      <Text style={styles.muted}>{tests.length} of {limit} tests saved</Text>
      {full ? <Text style={styles.muted}>Delete a test to add a new one.</Text> : null}
    </View> : null}
    {remove.error ? <Text style={styles.error}>{remove.error instanceof Error ? remove.error.message : 'Could not delete this test.'}</Text> : null}
  </View>;

  return <>
    <ListScreen title="My Tests" data={tests} keyExtractor={t => t.id}
      pageHeader={<BackHeader title="My Tests" subtitle="Make a test with AI, then take it here" fallback="/more"
        action={list.data && !full ? <Pressable accessibilityRole="button" accessibilityLabel="Create a test" onPress={() => router.push('/create-test')} style={styles.add}><Ionicons name="add" size={22} color="#fff"/></Pressable> : undefined}/>}
      header={header} refreshing={list.isRefetching} onRefresh={() => void list.refetch()}
      empty={list.data ? <HowItWorks/> : null}
      renderItem={({item}) => <TestCard test={item} onDelete={() => setDeleting(item)}/>}/>
    {deleting ? <AlertDialog icon="trash-outline" title="Delete this test?" description={`“${deleting.title}” and its results will be deleted. This cannot be undone.`}
      cancelLabel="Keep" confirmLabel="Delete" busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)}/> : null}
  </>;
}

function HowItWorks() {
  const steps = ['Choose a subject, topics and number of questions.', 'Send the prompt to ChatGPT or Gemini.', 'Paste its answer back here, and take your test.'];
  return <Card>
    <Heading>Make your own test</Heading>
    {steps.map((step, i) => <View key={step} style={styles.step}><View style={styles.stepNumber}><Text style={styles.stepText}>{i + 1}</Text></View><Text style={styles.stepCopy}>{step}</Text></View>)}
    <Button icon="add" label="Create a test" onPress={() => router.push('/create-test')}/>
  </Card>;
}

function TestCard({test, onDelete}: {test: MyTestListItem; onDelete: () => void}) {
  const style = subjectStyle(test.subject);
  const best = test.best_correct;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${test.title}. ${test.question_count} questions. Open`} onPress={() => router.push({pathname: '/my-test/[id]', params: {id: test.id}})}
    style={({pressed}) => [styles.card, pressed && {opacity: .8}]}>
    <View style={[styles.icon, {backgroundColor: style.color + '18'}]}><Ionicons name={style.icon} size={21} color={style.color}/></View>
    <View style={styles.copy}>
      <Text style={styles.title} numberOfLines={2}>{test.title}</Text>
      <Text style={styles.muted}>{test.subject} · {test.medium === 'telugu' ? 'Telugu' : 'English'} · {test.question_count} Qs · {test.duration_minutes} min</Text>
      <View style={styles.footer}>
        <Text style={best !== null ? styles.best : styles.muted}>{best !== null ? `Best ${best}/${test.question_count} · ${test.attempts} attempt${test.attempts === 1 ? '' : 's'}` : 'Not taken yet'}</Text>
        <Text style={styles.start}>{best !== null ? 'Retake' : 'Start'} →</Text>
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${test.title}`} hitSlop={8} onPress={onDelete} style={styles.delete}>
      <Ionicons name="trash-outline" size={18} color={colors.muted}/>
    </Pressable>
  </Pressable>;
}

const styles = StyleSheet.create({
  muted: {fontSize: 12, lineHeight: 18, color: colors.muted}, error: {fontSize: 13, color: colors.red},
  summary: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6},
  add: {width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary},
  step: {flexDirection: 'row', alignItems: 'center', gap: 10},
  stepNumber: {width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft},
  stepText: {fontSize: 12, fontWeight: '800', color: colors.primary}, stepCopy: {flex: 1, fontSize: 13, lineHeight: 20, color: colors.ink},
  card: {flexDirection: 'row', gap: 12, padding: 14, marginBottom: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  icon: {width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  copy: {flex: 1, minWidth: 0, gap: 4},
  title: {fontSize: 15, lineHeight: 21, fontWeight: '700', color: colors.ink},
  footer: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4},
  best: {fontSize: 12, fontWeight: '700', color: colors.green}, start: {fontSize: 13, fontWeight: '700', color: colors.primary},
  delete: {width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
});
