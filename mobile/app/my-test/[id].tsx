// Take a My Tests test: intro → timed test → result with review. The score
// is computed here for an instant result and again on the server when saved.
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Card, Button, Loading, ErrorState, Stats, Heading, Body } from '@/components/ui';
import { BackHeader } from '@/components/back-header';
import { AlertDialog } from '@/components/alert-dialog';
import { myTestsService } from '@/services/learning-service';
import { answerString, clockText, gradeAnswers } from '@/utils/roadmap';
import { colors } from '@/utils/theme';
import type { AnswerLetter, MyTestDetail, MyTestQuestion } from '@/types/learning';

const LETTERS: AnswerLetter[] = ['A', 'B', 'C', 'D'];
const optionText = (q: MyTestQuestion, letter: AnswerLetter) => q[`option_${letter.toLowerCase()}` as 'option_a'];

type Finished = {answers: (AnswerLetter | null)[]; correct: number; seconds: number};

export default function MyTestScreen() {
  const {id} = useLocalSearchParams<{id: string}>();
  const test = useQuery({queryKey: ['my-test', id], queryFn: () => myTestsService.get(id), enabled: !!id});
  const [stage, setStage] = useState<'intro' | 'running' | 'result'>('intro');
  const [finished, setFinished] = useState<Finished | null>(null);
  const cache = useQueryClient();
  const submit = useMutation({
    mutationFn: (f: Finished) => myTestsService.submit(id, answerString(f.answers), f.seconds),
    onSuccess: () => { void cache.invalidateQueries({queryKey: ['my-tests']}); void cache.invalidateQueries({queryKey: ['my-test', id]}); },
  });

  if (test.isPending || test.error || !test.data) {
    return <Screen title="My test" pageHeader={<BackHeader title="My test" fallback="/my-tests"/>}>
      {test.isPending ? <Loading/> : <ErrorState error={test.error} retry={() => void test.refetch()}/>}
    </Screen>;
  }
  const data = test.data.test;
  if (stage === 'running') {
    return <Runner test={data} onFinish={f => { setFinished(f); setStage('result'); submit.mutate(f); }} onQuit={() => setStage('intro')}/>;
  }
  if (stage === 'result' && finished) {
    return <Result test={data} finished={finished} saving={submit.isPending} saveError={submit.error} retrySave={() => submit.mutate(finished)}
      onRetake={() => { submit.reset(); setFinished(null); setStage('running'); }}/>;
  }
  const attempts = test.data.attempts;
  return <Screen title={data.title} pageHeader={<BackHeader title={data.title} subtitle={`${data.subject} · ${data.medium === 'telugu' ? 'Telugu' : 'English'} medium`} fallback="/my-tests"/>}>
    <Stats items={[{label: 'questions', value: data.questions.length}, {label: 'minutes', value: data.duration_minutes}]}/>
    <Card>
      <Heading>Before you start</Heading>
      <Body>Answer in any order. Use the grid to jump between questions. The test submits itself when the time is up.</Body>
      <Button icon="play" label={attempts.length ? 'Retake test' : 'Start test'} onPress={() => setStage('running')}/>
    </Card>
    {attempts.length ? <Card>
      <Heading>Your attempts</Heading>
      {attempts.slice(0, 5).map(a => <View key={a.id} style={styles.attempt}>
        <Text style={styles.attemptScore}>{a.correct_count}/{a.total_questions}</Text>
        <Text style={styles.muted}>{Math.round(a.correct_count / Math.max(1, a.total_questions) * 100)}% · {clockText(a.time_spent_seconds)} · {new Date(a.submitted_at).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})}</Text>
      </View>)}
    </Card> : null}
  </Screen>;
}

function KeepAwake() { useKeepAwake(); return null; }

function Runner({test, onFinish, onQuit}: {test: MyTestDetail; onFinish: (f: Finished) => void; onQuit: () => void}) {
  const total = test.questions.length;
  const limit = test.duration_minutes * 60;
  const [answers, setAnswers] = useState<(AnswerLetter | null)[]>(() => Array(total).fill(null));
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [grid, setGrid] = useState(false);
  const [confirm, setConfirm] = useState<'submit' | 'quit' | null>(null);
  const [started] = useState(() => Date.now());
  const done = useRef(false);

  const finish = useCallback((final: (AnswerLetter | null)[]) => {
    if (done.current) return;
    done.current = true;
    const seconds = Math.min(limit, Math.round((Date.now() - started) / 1000));
    onFinish({answers: final, correct: gradeAnswers(final, test.questions), seconds});
  }, [limit, onFinish, started, test.questions]);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [started]);
  const latest = useRef(answers);
  useEffect(() => { latest.current = answers; }, [answers]);
  useEffect(() => { if (elapsed >= limit) finish(latest.current); }, [elapsed, limit, finish]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setConfirm('quit'); return true; });
    return () => sub.remove();
  }, []);

  const q = test.questions[index];
  const answered = answers.filter(Boolean).length;
  const remaining = Math.max(0, limit - elapsed);
  const choose = (letter: AnswerLetter) => setAnswers(prev => prev.map((a, i) => i === index ? (a === letter ? null : letter) : a));

  return <SafeAreaView style={styles.runner} edges={['top', 'left', 'right', 'bottom']}>
    <KeepAwake/>
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Leave test" onPress={() => setConfirm('quit')} style={styles.topButton}><Ionicons name="close" size={22} color={colors.primary}/></Pressable>
      <View style={{flex: 1, minWidth: 0}}>
        <Text style={styles.topTitle} numberOfLines={1}>{test.title}</Text>
        <Text style={styles.muted}>{answered}/{total} answered</Text>
      </View>
      <View style={[styles.clock, remaining <= 60 && styles.clockLow]}>
        <Ionicons name="time-outline" size={15} color={remaining <= 60 ? colors.red : colors.primary}/>
        <Text style={[styles.clockText, remaining <= 60 && {color: colors.red}]}>{clockText(remaining)}</Text>
      </View>
    </View>
    <View style={styles.progress}><View style={[styles.progressFill, {width: `${(index + 1) / total * 100}%`}]}/></View>

    <ScrollView contentContainerStyle={styles.questionArea}>
      <Text style={styles.qNumber}>Question {index + 1} of {total}</Text>
      <Text style={styles.question}>{q.question}</Text>
      {LETTERS.map(letter => {
        const selected = answers[index] === letter;
        return <Pressable key={letter} accessibilityRole="radio" accessibilityState={{selected}} onPress={() => choose(letter)} style={[styles.option, selected && styles.optionOn]}>
          <View style={[styles.letter, selected && styles.letterOn]}><Text style={[styles.letterText, selected && {color: '#fff'}]}>{letter}</Text></View>
          <Text style={styles.optionText}>{optionText(q, letter)}</Text>
        </Pressable>;
      })}
    </ScrollView>

    <View style={styles.bottomBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous question" disabled={index === 0} onPress={() => setIndex(index - 1)} style={[styles.navButton, index === 0 && {opacity: .35}]}>
        <Ionicons name="chevron-back" size={20} color={colors.primary}/>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="All questions" onPress={() => setGrid(true)} style={styles.gridButton}>
        <Ionicons name="grid-outline" size={18} color={colors.primary}/><Text style={styles.gridText}>{index + 1}/{total}</Text>
      </Pressable>
      {index < total - 1
        ? <Pressable accessibilityRole="button" accessibilityLabel="Next question" onPress={() => setIndex(index + 1)} style={[styles.navButton, styles.navPrimary]}><Ionicons name="chevron-forward" size={20} color="#fff"/></Pressable>
        : <Pressable accessibilityRole="button" onPress={() => setConfirm('submit')} style={[styles.submit]}><Text style={styles.submitText}>Submit</Text></Pressable>}
    </View>

    <Modal visible={grid} transparent animationType="slide" onRequestClose={() => setGrid(false)} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={() => setGrid(false)}/>
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.sheetHead}><Heading>Questions</Heading><Text style={styles.muted}>{answered} answered · {total - answered} left</Text></View>
        <ScrollView contentContainerStyle={styles.grid}>
          {answers.map((a, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Question ${i + 1}${a ? ', answered' : ''}`} onPress={() => { setIndex(i); setGrid(false); }}
            style={[styles.cell, a && styles.cellAnswered, i === index && styles.cellCurrent]}>
            <Text style={[styles.cellText, a && {color: '#fff'}]}>{i + 1}</Text>
          </Pressable>)}
        </ScrollView>
        <Button label="Submit test" onPress={() => { setGrid(false); setConfirm('submit'); }}/>
      </SafeAreaView>
    </Modal>

    {confirm === 'submit' ? <AlertDialog icon="checkmark-done-outline" title="Submit the test?"
      description={total - answered ? `${total - answered} question${total - answered === 1 ? ' is' : 's are'} not answered.` : 'All questions are answered.'}
      cancelLabel="Keep going" confirmLabel="Submit" onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); finish(answers); }}/> : null}
    {confirm === 'quit' ? <AlertDialog icon="exit-outline" title="Leave the test?" description="Your answers in this attempt will not be saved."
      cancelLabel="Stay" confirmLabel="Leave" onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); onQuit(); }}/> : null}
  </SafeAreaView>;
}

function Result({test, finished, saving, saveError, retrySave, onRetake}: {test: MyTestDetail; finished: Finished; saving: boolean; saveError: unknown; retrySave: () => void; onRetake: () => void}) {
  const [wrongOnly, setWrongOnly] = useState(true);
  const total = test.questions.length;
  const skipped = finished.answers.filter(a => !a).length;
  const percent = Math.round(finished.correct / Math.max(1, total) * 100);
  const items = test.questions.map((q, i) => ({q, i, answer: finished.answers[i]})).filter(x => !wrongOnly || x.answer !== x.q.correct_answer);
  return <Screen title="Result" pageHeader={<BackHeader title="Your result" subtitle={test.title} fallback="/my-tests"/>}>
    <View style={styles.score}>
      <Text style={styles.scoreValue}>{finished.correct}<Text style={styles.scoreTotal}>/{total}</Text></Text>
      <Text style={styles.scorePercent}>{percent}% correct</Text>
      <Text style={styles.scoreNote}>{saving ? 'Saving your result…' : saveError ? 'Not saved yet.' : 'Saved to My Tests.'}</Text>
    </View>
    {saveError ? <Button secondary icon="cloud-upload-outline" label="Save result again" onPress={retrySave}/> : null}
    <Stats items={[{label: 'wrong', value: total - finished.correct - skipped}, {label: 'not answered', value: skipped}, {label: 'time', value: clockText(finished.seconds)}]}/>
    <View style={styles.reviewHead}>
      <Heading>Review</Heading>
      <Pressable accessibilityRole="switch" accessibilityState={{checked: wrongOnly}} onPress={() => setWrongOnly(!wrongOnly)} style={[styles.filter, wrongOnly && styles.filterOn]}>
        <Text style={[styles.filterText, wrongOnly && {color: colors.primary}]}>{wrongOnly ? 'Wrong only' : 'All questions'}</Text>
      </Pressable>
    </View>
    {items.length === 0 ? <Body>Every question is right. Well done!</Body> : null}
    {items.map(({q, i, answer}) => <View key={i} style={styles.review}>
      <Text style={styles.qNumber}>Question {i + 1}</Text>
      <Text style={styles.reviewQuestion}>{q.question}</Text>
      {LETTERS.map(letter => {
        const right = letter === q.correct_answer; const mine = letter === answer;
        if (!right && !mine) return null;
        return <View key={letter} style={[styles.reviewOption, right ? styles.reviewRight : styles.reviewWrong]}>
          <Ionicons name={right ? 'checkmark-circle' : 'close-circle'} size={17} color={right ? colors.green : colors.red}/>
          <Text style={styles.reviewOptionText}>{letter}. {optionText(q, letter)}{mine ? '  (your answer)' : ''}</Text>
        </View>;
      })}
      {!answer ? <Text style={styles.muted}>Not answered.</Text> : null}
      {q.explanation ? <Text style={styles.explanation}>{q.explanation}</Text> : null}
    </View>)}
    <Button icon="refresh" label="Retake test" onPress={onRetake}/>
    <Button secondary label="Back to My Tests" onPress={() => router.replace('/my-tests')}/>
  </Screen>;
}

const styles = StyleSheet.create({
  muted: {fontSize: 12, lineHeight: 18, color: colors.muted},
  attempt: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border},
  attemptScore: {width: 64, fontSize: 16, fontWeight: '800', color: colors.primary},
  runner: {flex: 1, backgroundColor: colors.background},
  topBar: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border},
  topButton: {width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft},
  topTitle: {fontSize: 14, fontWeight: '700', color: colors.ink},
  clock: {flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, minHeight: 36, borderRadius: 12, backgroundColor: colors.primarySoft},
  clockLow: {backgroundColor: colors.redSoft}, clockText: {fontSize: 14, fontWeight: '800', color: colors.primary, fontVariant: ['tabular-nums']},
  progress: {height: 3, backgroundColor: colors.border}, progressFill: {height: 3, backgroundColor: colors.primary},
  questionArea: {padding: 18, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center'},
  qNumber: {fontSize: 12, fontWeight: '700', color: colors.primary},
  question: {fontSize: 17, lineHeight: 27, fontWeight: '600', color: colors.ink, marginBottom: 4},
  option: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 56, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card},
  optionOn: {borderColor: colors.primary, backgroundColor: colors.primarySoft},
  letter: {width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background},
  letterOn: {backgroundColor: colors.primary}, letterText: {fontSize: 14, fontWeight: '800', color: colors.muted},
  optionText: {flex: 1, fontSize: 15, lineHeight: 22, color: colors.ink},
  bottomBar: {flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border},
  navButton: {width: 52, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  navPrimary: {borderColor: colors.primary, backgroundColor: colors.primary},
  gridButton: {flex: 1, height: 48, flexDirection: 'row', gap: 6, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft},
  gridText: {fontSize: 14, fontWeight: '700', color: colors.primary},
  submit: {height: 48, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green},
  submitText: {fontSize: 15, fontWeight: '800', color: '#fff'},
  backdrop: {flex: 1, backgroundColor: 'rgba(27,26,46,.45)'},
  sheet: {maxHeight: '75%', padding: 18, gap: 12, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.card},
  sheetHead: {gap: 2},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4},
  cell: {width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  cellAnswered: {borderColor: colors.primary, backgroundColor: colors.primary}, cellCurrent: {borderWidth: 2.5, borderColor: '#F97316'},
  cellText: {fontSize: 13, fontWeight: '700', color: colors.ink},
  score: {alignItems: 'center', gap: 4, padding: 22, borderRadius: 24, backgroundColor: colors.primary},
  scoreValue: {fontSize: 44, fontWeight: '900', color: '#fff'}, scoreTotal: {fontSize: 22, fontWeight: '700', color: '#C9C5EA'},
  scorePercent: {fontSize: 15, fontWeight: '700', color: '#fff'}, scoreNote: {fontSize: 12, color: '#C9C5EA'},
  reviewHead: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10},
  filter: {minHeight: 36, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, justifyContent: 'center'},
  filterOn: {borderColor: colors.primary, backgroundColor: colors.primarySoft}, filterText: {fontSize: 12, fontWeight: '700', color: colors.muted},
  review: {padding: 14, gap: 7, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  reviewQuestion: {fontSize: 14, lineHeight: 22, fontWeight: '600', color: colors.ink},
  reviewOption: {flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 12},
  reviewRight: {backgroundColor: colors.greenSoft}, reviewWrong: {backgroundColor: colors.redSoft},
  reviewOptionText: {flex: 1, fontSize: 13, lineHeight: 20, color: colors.ink},
  explanation: {fontSize: 13, lineHeight: 20, color: colors.muted},
});
