// Create a test on a phone: describe it, send the prompt to an AI app, paste
// the CSV text it replies with, check it, save. The website does the prompt
// and the checking (/api/dsc-sgt/my-tests/prompt and /check), so the rules
// match a website upload.
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Card, Button, Chips, Input, SectionHeading, Body } from '@/components/ui';
import { BackHeader } from '@/components/back-header';
import { useAuth } from '@/store/auth';
import { myTestsService, type PromptRequest } from '@/services/learning-service';
import { PRACTICE_SUBJECTS } from '@/utils/practice-subjects';
import { colors } from '@/utils/theme';
import type { PastedCheck, PlanMedium } from '@/types/learning';

const COUNTS = [50, 100, 160] as const;
const DIFFICULTIES: {value: PromptRequest['difficulty']; label: string}[] = [
  {value: 'mixed', label: 'Mixed'}, {value: 'easy', label: 'Easy'}, {value: 'medium', label: 'Medium'}, {value: 'hard', label: 'Hard'},
];
/** The real paper: 160 questions in 150 minutes. */
const defaultMinutes = (count: number) => Math.max(5, Math.round(count * 150 / 160));

export default function CreateTest() {
  const {user} = useAuth();
  const cache = useQueryClient();
  const [title, setTitle] = useState('');
  const [medium, setMedium] = useState<PlanMedium>(user?.educationMedium === 'telugu' ? 'telugu' : 'english');
  const [subject, setSubject] = useState<string>(PRACTICE_SUBJECTS[0].name);
  const [topics, setTopics] = useState<string[]>([]);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [count, setCount] = useState<number>(50);
  const [difficulty, setDifficulty] = useState<PromptRequest['difficulty']>('mixed');
  const [pasted, setPasted] = useState('');
  const [checked, setChecked] = useState<PastedCheck | null>(null);
  const [minutes, setMinutes] = useState('');

  const subjectInfo = PRACTICE_SUBJECTS.find(s => s.name === subject) ?? PRACTICE_SUBJECTS[0];
  const topicList = useQuery({queryKey: ['test-topics', medium, subject], queryFn: () => myTestsService.topics(medium, subject), staleTime: 10 * 60 * 1000});
  const available = topicList.data?.data.available_topics ?? [];
  const shownTopics = showAllTopics ? available : available.slice(0, 12);

  const promptRequest: PromptRequest = {subject: medium === 'telugu' ? `${subjectInfo.name} (${subjectInfo.teluguName})` : subjectInfo.name, medium, topics, question_count: count, difficulty};
  const prompt = useMutation({mutationFn: () => myTestsService.prompt(promptRequest)});
  const check = useMutation({
    mutationFn: () => myTestsService.check(pasted),
    onSuccess: result => { setChecked(result); setMinutes(String(defaultMinutes(result.questions.length))); },
  });
  const save = useMutation({
    mutationFn: () => myTestsService.create({
      title: title.trim(), medium, subject, topics,
      duration_minutes: Number(minutes) || defaultMinutes(checked?.questions.length ?? count),
      questions: checked?.questions ?? [],
    }),
    onSuccess: ({test}) => { void cache.invalidateQueries({queryKey: ['my-tests']}); router.replace({pathname: '/my-test/[id]', params: {id: test.id}}); },
  });

  // Changing what the test is about makes an old prompt stale.
  const change = <T,>(set: (value: T) => void) => (value: T) => { set(value); prompt.reset(); };
  const toggleTopic = (topic: string) => change(setTopics)(topics.includes(topic) ? topics.filter(t => t !== topic) : [...topics, topic].slice(0, 30));
  const send = (text: string) => { void Share.share({message: text}); };
  const ready = (checked?.questions.length ?? 0) > 0;

  return <Screen title="Create a test" pageHeader={<BackHeader title="Create a test" subtitle="With ChatGPT, Gemini or Claude" fallback="/my-tests"/>}>
    <Card>
      <SectionHeading step={1} title="Describe the test"/>
      <Input label="Test name" value={title} onChangeText={setTitle} placeholder="e.g. Science — Living world"/>
      <Label text="Medium"/>
      <Chips items={[{value: 'telugu', label: 'Telugu'}, {value: 'english', label: 'English'}]} selected={medium} onSelect={change((m: PlanMedium) => { setMedium(m); setTopics([]); })}/>
      <Label text="Subject"/>
      <Chips items={PRACTICE_SUBJECTS.map(s => ({value: s.name, label: s.name === 'Educational Psychology + Perspectives in Education' ? 'Psychology + Perspectives' : s.name}))} selected={subject}
        onSelect={change((s: string) => { setSubject(s); setTopics([]); setShowAllTopics(false); })}/>
      <Label text={`Topics${topics.length ? ` · ${topics.length} chosen` : ' · optional, leave empty for the whole subject'}`}/>
      {topicList.isPending ? <Text style={styles.muted}>Loading topics…</Text> : null}
      {available.length ? <View style={styles.wrap}>
        {shownTopics.map(t => {
          const on = topics.includes(t.name);
          return <Pressable key={t.name} accessibilityRole="checkbox" accessibilityState={{checked: on}} onPress={() => toggleTopic(t.name)} style={[styles.topic, on && styles.topicOn]}>
            {on ? <Ionicons name="checkmark" size={14} color={colors.primary}/> : null}
            <Text style={[styles.topicText, on && {color: colors.primary, fontWeight: '700'}]} numberOfLines={1}>{t.name}</Text>
          </Pressable>;
        })}
        {available.length > 12 ? <Pressable accessibilityRole="button" onPress={() => setShowAllTopics(!showAllTopics)} style={styles.more}>
          <Text style={styles.moreText}>{showAllTopics ? 'Show fewer' : `Show all ${available.length}`}</Text>
        </Pressable> : null}
      </View> : null}
      <Label text="Questions"/>
      <Chips items={COUNTS.map(c => ({value: String(c), label: String(c)}))} selected={String(count)} onSelect={change((c: string) => setCount(Number(c)))}/>
      <Label text="Difficulty"/>
      <Chips items={DIFFICULTIES} selected={difficulty} onSelect={change(setDifficulty)}/>
    </Card>

    <Card>
      <SectionHeading step={2} title="Send the prompt to an AI app"/>
      {!prompt.data ? <Button icon="sparkles-outline" label="Get the prompt" busy={prompt.isPending} onPress={() => prompt.mutate()}/> : <>
        <View style={styles.promptBox}><Text selectable style={styles.promptText} numberOfLines={8}>{prompt.data.prompt}</Text></View>
        <Button icon="share-outline" label="Send to an AI app" onPress={() => send(prompt.data.prompt)}/>
        <Text style={styles.hint}>Pick ChatGPT, Gemini or Claude, or Copy. For {count} questions the AI may reply in parts: copy every part.</Text>
      </>}
      {prompt.error ? <Text style={styles.error}>{prompt.error instanceof Error ? prompt.error.message : 'Could not make the prompt.'}</Text> : null}
    </Card>

    <Card>
      <SectionHeading step={3} title="Paste the AI's answer"/>
      <TextInput accessibilityLabel="Questions from the AI, as CSV text" multiline value={pasted} placeholder="Long-press, then Paste. Paste every part, one after another."
        placeholderTextColor={colors.muted} onChangeText={text => { setPasted(text); setChecked(null); }} style={styles.paste} autoCorrect={false} autoCapitalize="none" textAlignVertical="top"/>
      <Button secondary icon="checkmark-done-outline" label="Check the questions" disabled={!pasted.trim()} busy={check.isPending} onPress={() => check.mutate()}/>
      {check.error ? <Text style={styles.error}>{check.error instanceof Error ? check.error.message : 'Could not check the questions.'}</Text> : null}
      {checked ? <View style={[styles.result, ready ? styles.resultOk : styles.resultBad]}>
        <Text style={styles.resultTitle}>{ready ? `${checked.questions.length} questions ready` : 'No questions could be read'}</Text>
        {checked.extra ? <Body>Only the first {checked.questions.length} are kept: a test has at most 160.</Body> : null}
        {checked.problem_count ? <>
          <Text style={styles.muted}>{checked.problem_count} row{checked.problem_count === 1 ? '' : 's'} skipped:</Text>
          {checked.problems.slice(0, 5).map(p => <Text key={`${p.row}-${p.message}`} style={styles.problem}>Row {p.row}: {p.message}</Text>)}
        </> : null}
        {!ready ? <Body>Paste the AI&apos;s reply as it is, including the header row (question, option_a, …).</Body> : null}
      </View> : null}
    </Card>

    <Card>
      <SectionHeading step={4} title="Save and take it"/>
      <Input label="Time in minutes" numeric value={minutes} onChangeText={setMinutes} placeholder={String(defaultMinutes(count))}/>
      {!title.trim() ? <Text style={styles.muted}>Give the test a name in step 1.</Text> : null}
      <Button icon="save-outline" label="Save test" disabled={!ready || !title.trim()} busy={save.isPending} onPress={() => save.mutate()}/>
      {save.error ? <Text style={styles.error}>{save.error instanceof Error ? save.error.message : 'Could not save the test.'}</Text> : null}
    </Card>
  </Screen>;
}

function Label({text}: {text: string}) { return <Text style={styles.label}>{text}</Text>; }

const styles = StyleSheet.create({
  label: {fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: -4},
  muted: {fontSize: 12, lineHeight: 18, color: colors.muted}, error: {fontSize: 13, lineHeight: 19, color: colors.red},
  wrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  topic: {flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', minHeight: 36, paddingHorizontal: 11, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  topicOn: {borderColor: colors.primary, backgroundColor: colors.primarySoft},
  topicText: {flexShrink: 1, fontSize: 13, color: colors.muted},
  more: {minHeight: 36, paddingHorizontal: 11, justifyContent: 'center'}, moreText: {fontSize: 13, fontWeight: '700', color: colors.primary},
  promptBox: {padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background},
  promptText: {fontSize: 12, lineHeight: 18, color: colors.ink},
  hint: {fontSize: 12, lineHeight: 18, color: colors.muted},
  paste: {minHeight: 140, maxHeight: 260, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, fontSize: 13, color: colors.ink},
  result: {padding: 12, gap: 4, borderRadius: 14, borderWidth: 1},
  resultOk: {borderColor: '#A7D7BF', backgroundColor: colors.greenSoft}, resultBad: {borderColor: '#F3C1B6', backgroundColor: colors.redSoft},
  resultTitle: {fontSize: 15, fontWeight: '800', color: colors.ink},
  problem: {fontSize: 12, lineHeight: 18, color: colors.red},
});
