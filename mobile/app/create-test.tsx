// Create a test on a phone, one step at a time:
//   1 Basics      name, medium, subject
//   2 Questions   how many, difficulty, topics (optional)
//   3 Add         upload an Excel/CSV file, or make one with an AI app
//   4 Save        check the summary, set the time, save and start
// The website reads the file or pasted text (/api/dsc-sgt/my-tests/check) and
// builds the AI prompt (/prompt), so the rules match a website upload.
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, BackHandler, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { File } from 'expo-file-system';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Button, Heading } from '@/components/ui';
import { BackHeader } from '@/components/back-header';
import { useAuth } from '@/store/auth';
import { myTestsService, type PromptRequest } from '@/services/learning-service';
import { PRACTICE_SUBJECTS } from '@/utils/practice-subjects';
import { colors, subjectStyle } from '@/utils/theme';
import type { PastedCheck, PlanMedium } from '@/types/learning';

const STEPS = ['Basics', 'Questions', 'Add', 'Save'] as const;
const COUNTS = [{n: 50, note: 'Quick test'}, {n: 100, note: 'Half paper'}, {n: 160, note: 'Full paper'}] as const;
const DIFFICULTIES: {value: PromptRequest['difficulty']; label: string}[] = [
  {value: 'mixed', label: 'Mixed'}, {value: 'easy', label: 'Easy'}, {value: 'medium', label: 'Medium'}, {value: 'hard', label: 'Hard'},
];
const FILE_TYPES = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'];
const MAX_FILE_BYTES = 2 * 1024 * 1024;
/** The real paper: 160 questions in 150 minutes. */
const defaultMinutes = (count: number) => Math.max(5, Math.round(count * 150 / 160));
const shortSubject = (name: string) => name === 'Educational Psychology + Perspectives in Education' ? 'Psychology + Perspectives' : name;

export default function CreateTest() {
  const {user} = useAuth();
  const cache = useQueryClient();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [medium, setMedium] = useState<PlanMedium>(user?.educationMedium === 'telugu' ? 'telugu' : 'english');
  const [subject, setSubject] = useState<string>(PRACTICE_SUBJECTS[0].name);
  const [count, setCount] = useState<number>(50);
  const [difficulty, setDifficulty] = useState<PromptRequest['difficulty']>('mixed');
  const [topics, setTopics] = useState<string[]>([]);
  const [allTopics, setAllTopics] = useState(false);
  const [checked, setChecked] = useState<PastedCheck | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [minutes, setMinutes] = useState(defaultMinutes(50));
  const [fileError, setFileError] = useState<string | null>(null);

  const subjectInfo = PRACTICE_SUBJECTS.find(s => s.name === subject) ?? PRACTICE_SUBJECTS[0];
  const topicList = useQuery({queryKey: ['test-topics', medium, subject], queryFn: () => myTestsService.topics(medium, subject), staleTime: 10 * 60 * 1000});
  const available = topicList.data?.data.available_topics ?? [];

  const promptRequest: PromptRequest = {subject: medium === 'telugu' ? `${subjectInfo.name} (${subjectInfo.teluguName})` : subjectInfo.name, medium, topics, question_count: count, difficulty};
  const prompt = useMutation({mutationFn: () => myTestsService.prompt(promptRequest)});
  const accept = (result: PastedCheck, from: string) => { setChecked(result); setSource(from); if (result.questions.length) setMinutes(defaultMinutes(result.questions.length)); };
  const readFile = useMutation({
    mutationFn: async () => {
      const picked = await File.pickFileAsync({mimeTypes: FILE_TYPES});
      if (picked.canceled) return null;
      const file = picked.result;
      if (file.size > MAX_FILE_BYTES) throw new Error('Choose a file of 2 MB or less.');
      return {name: file.name, result: await myTestsService.checkFile(await file.base64(), file.name)};
    },
    onMutate: () => setFileError(null),
    onSuccess: picked => { if (picked) accept(picked.result, picked.name); },
    onError: err => setFileError(err instanceof Error ? err.message : 'Could not read this file.'),
  });
  const readPaste = useMutation({mutationFn: () => myTestsService.check(pasted), onSuccess: result => accept(result, 'Pasted text')});
  const save = useMutation({
    mutationFn: () => myTestsService.create({title: title.trim(), medium, subject, topics, duration_minutes: minutes, questions: checked?.questions ?? []}),
    onSuccess: ({test}) => { void cache.invalidateQueries({queryKey: ['my-tests']}); router.replace({pathname: '/my-test/[id]', params: {id: test.id}}); },
  });

  // What the test is about changes the prompt.
  const resetPrompt = () => prompt.reset();
  const ready = (checked?.questions.length ?? 0) > 0;
  const canNext = step === 0 ? !!title.trim() : step === 2 ? ready : true;
  const back = () => { if (step > 0) setStep(step - 1); else if (router.canGoBack()) router.back(); else router.replace('/my-tests'); };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (step === 0) return false; setStep(step - 1); return true; });
    return () => sub.remove();
  }, [step]);

  const footer = <View style={styles.footer}>
    {step > 0 ? <View style={styles.footerSide}><Button secondary label="Back" onPress={back}/></View> : null}
    <View style={styles.footerMain}>
      {step < 3
        ? <Button label={step === 2 && !ready ? 'Add questions first' : 'Next'} icon={step === 2 && !ready ? undefined : 'arrow-forward'} disabled={!canNext} onPress={() => setStep(step + 1)}/>
        : <Button icon="play" label="Save and start" busy={save.isPending} disabled={!ready || !title.trim()} onPress={() => save.mutate()}/>}
    </View>
  </View>;

  return <Screen title="Create a test" footer={footer} pageHeader={<View style={{gap: 14}}>
    <BackHeader title="Create a test" subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`} fallback="/my-tests" onBack={back}/>
    <View style={styles.progress}>{STEPS.map((s, i) => <View key={s} style={[styles.progressStep, i <= step && styles.progressOn]}/>)}</View>
  </View>}>

    {step === 0 ? <>
      <Field label="Test name" hint="So you can find it later.">
        <TextInput accessibilityLabel="Test name" value={title} onChangeText={setTitle} placeholder="e.g. Science — Living world" placeholderTextColor={colors.muted} maxLength={120} style={styles.input}/>
      </Field>
      <Field label="Medium" hint="The language of the questions.">
        <Segmented items={[{value: 'telugu', label: 'Telugu'}, {value: 'english', label: 'English'}]} value={medium} onChange={m => { setMedium(m); setTopics([]); resetPrompt(); }}/>
      </Field>
      <Field label="Subject">
        <View style={styles.grid}>
          {PRACTICE_SUBJECTS.map(s => {
            const on = s.name === subject; const style = subjectStyle(s.name);
            return <Pressable key={s.name} accessibilityRole="radio" accessibilityState={{selected: on}} onPress={() => { setSubject(s.name); setTopics([]); setAllTopics(false); resetPrompt(); }}
              style={[styles.subject, on && styles.subjectOn]}>
              <View style={[styles.subjectIcon, {backgroundColor: style.color + '18'}]}><Ionicons name={style.icon} size={18} color={style.color}/></View>
              <Text style={[styles.subjectText, on && {color: colors.primary}]} numberOfLines={2}>{shortSubject(s.name)}</Text>
              {on ? <Ionicons name="checkmark-circle" size={18} color={colors.primary}/> : null}
            </Pressable>;
          })}
        </View>
      </Field>
    </> : null}

    {step === 1 ? <>
      <Field label="How many questions?">
        <View style={styles.counts}>
          {COUNTS.map(c => {
            const on = c.n === count;
            return <Pressable key={c.n} accessibilityRole="radio" accessibilityState={{selected: on}} onPress={() => { setCount(c.n); setMinutes(defaultMinutes(c.n)); resetPrompt(); }} style={[styles.count, on && styles.countOn]}>
              <Text style={[styles.countNumber, on && {color: colors.primary}]}>{c.n}</Text>
              <Text style={styles.countNote}>{c.note}</Text>
              <Text style={styles.countNote}>{defaultMinutes(c.n)} min</Text>
            </Pressable>;
          })}
        </View>
      </Field>
      <Field label="Difficulty">
        <Segmented items={DIFFICULTIES} value={difficulty} onChange={d => { setDifficulty(d); resetPrompt(); }}/>
      </Field>
      <Field label="Topics" hint={topics.length ? `${topics.length} chosen` : 'Optional. Leave all unticked for the whole subject.'}
        action={topics.length ? <Pressable accessibilityRole="button" onPress={() => { setTopics([]); resetPrompt(); }}><Text style={styles.link}>Clear</Text></Pressable> : undefined}>
        {topicList.isPending ? <ActivityIndicator color={colors.primary}/> : null}
        {topicList.data && !available.length ? <Text style={styles.hint}>No topic list for this subject. The test will cover the whole subject.</Text> : null}
        <View style={styles.wrap}>
          {(allTopics ? available : available.slice(0, 10)).map(t => {
            const on = topics.includes(t.name);
            return <Pressable key={t.name} accessibilityRole="checkbox" accessibilityState={{checked: on}} onPress={() => { setTopics(on ? topics.filter(x => x !== t.name) : [...topics, t.name].slice(0, 30)); resetPrompt(); }}
              style={[styles.topic, on && styles.topicOn]}>
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={16} color={on ? colors.primary : colors.muted}/>
              <Text style={[styles.topicText, on && {color: colors.primary, fontWeight: '700'}]} numberOfLines={2}>{t.name}</Text>
            </Pressable>;
          })}
        </View>
        {available.length > 10 ? <Pressable accessibilityRole="button" onPress={() => setAllTopics(!allTopics)}><Text style={styles.link}>{allTopics ? 'Show fewer topics' : `Show all ${available.length} topics`}</Text></Pressable> : null}
      </Field>
    </> : null}

    {step === 2 ? <>
      {ready && checked ? <View style={styles.ready}>
        <Ionicons name="checkmark-circle" size={28} color={colors.green}/>
        <View style={{flex: 1, minWidth: 0}}>
          <Text style={styles.readyTitle}>{checked.questions.length} questions ready</Text>
          <Text style={styles.hint} numberOfLines={1}>From {source}</Text>
        </View>
      </View> : null}
      {checked && (checked.problem_count || checked.extra || !ready) ? <View style={[styles.notice, !ready && styles.noticeBad]}>
        {!ready ? <Text style={styles.noticeTitle}>No questions could be read</Text> : null}
        {checked.extra ? <Text style={styles.noticeText}>Only the first {checked.questions.length} are kept: a test has at most 160.</Text> : null}
        {checked.problem_count ? <Text style={styles.noticeText}>{checked.problem_count} row{checked.problem_count === 1 ? ' was' : 's were'} skipped:</Text> : null}
        {checked.problems.slice(0, 4).map(p => <Text key={`${p.row}-${p.message}`} style={styles.problem}>Row {p.row}: {p.message}</Text>)}
        {!ready ? <Text style={styles.noticeText}>The file needs a header row: question, option_a, option_b, option_c, option_d, correct_answer.</Text> : null}
      </View> : null}

      <Pressable accessibilityRole="button" accessibilityLabel={ready ? 'Choose a different Excel or CSV file' : 'Upload an Excel or CSV file'} disabled={readFile.isPending} onPress={() => readFile.mutate()}
        style={({pressed}) => [styles.upload, pressed && {opacity: .75}]}>
        {readFile.isPending ? <ActivityIndicator color={colors.primary}/> : <Ionicons name="cloud-upload-outline" size={30} color={colors.primary}/>}
        <Text style={styles.uploadTitle}>{readFile.isPending ? 'Reading the file…' : ready ? 'Choose a different file' : 'Upload Excel or CSV file'}</Text>
        <Text style={styles.hint}>.xlsx or .csv, up to 2 MB</Text>
      </Pressable>
      {fileError ? <Text style={styles.error}>{fileError}</Text> : null}

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.aiIcon}><Ionicons name="sparkles" size={18} color="#7C3AED"/></View>
          <View style={{flex: 1, minWidth: 0}}>
            <Heading>No file yet? Make one with AI</Heading>
            <Text style={styles.hint}>Send the prompt to ChatGPT or Gemini, then upload the Excel file it gives you.</Text>
          </View>
        </View>
        {!prompt.data
          ? <Button secondary icon="sparkles-outline" label="Get the AI prompt" busy={prompt.isPending} onPress={() => prompt.mutate()}/>
          : <>
            <View style={styles.promptBox}><Text selectable style={styles.promptText} numberOfLines={5}>{prompt.data.prompt}</Text></View>
            <Button icon="share-outline" label="Send to an AI app" onPress={() => { void Share.share({message: prompt.data.prompt}); }}/>
          </>}
        {prompt.error ? <Text style={styles.error}>{prompt.error instanceof Error ? prompt.error.message : 'Could not make the prompt.'}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => setPasting(!pasting)} style={styles.pasteToggle}>
          <Ionicons name={pasting ? 'chevron-up' : 'clipboard-outline'} size={16} color={colors.primary}/>
          <Text style={styles.link}>{pasting ? 'Hide paste box' : 'The AI replied with text? Paste it instead'}</Text>
        </Pressable>
        {pasting ? <>
          <TextInput accessibilityLabel="Questions from the AI, as CSV text" multiline value={pasted} onChangeText={setPasted} autoCorrect={false} autoCapitalize="none" textAlignVertical="top"
            placeholder="Long-press, then Paste. Paste every part, one after another." placeholderTextColor={colors.muted} style={styles.paste}/>
          <Button secondary icon="checkmark-done-outline" label="Read the pasted text" disabled={!pasted.trim()} busy={readPaste.isPending} onPress={() => readPaste.mutate()}/>
          {readPaste.error ? <Text style={styles.error}>{readPaste.error instanceof Error ? readPaste.error.message : 'Could not read the text.'}</Text> : null}
        </> : null}
      </View>
    </> : null}

    {step === 3 && checked ? <>
      <View style={styles.card}>
        <Heading>{title.trim()}</Heading>
        <Summary icon="book-outline" label="Subject" value={shortSubject(subject)}/>
        <Summary icon="language-outline" label="Medium" value={medium === 'telugu' ? 'Telugu' : 'English'}/>
        <Summary icon="help-circle-outline" label="Questions" value={`${checked.questions.length}`}/>
        <Summary icon="pricetags-outline" label="Topics" value={topics.length ? `${topics.length} chosen` : 'Whole subject'}/>
      </View>
      <Field label="Time" hint="The test submits itself when the time is up.">
        <View style={styles.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel="5 minutes less" disabled={minutes <= 5} onPress={() => setMinutes(Math.max(5, minutes - 5))} style={[styles.stepButton, minutes <= 5 && {opacity: .35}]}><Ionicons name="remove" size={22} color={colors.primary}/></Pressable>
          <View style={styles.stepValue}><Text style={styles.stepNumber}>{minutes}</Text><Text style={styles.hint}>minutes</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="5 minutes more" disabled={minutes >= 300} onPress={() => setMinutes(Math.min(300, minutes + 5))} style={[styles.stepButton, minutes >= 300 && {opacity: .35}]}><Ionicons name="add" size={22} color={colors.primary}/></Pressable>
        </View>
      </Field>
      {save.error ? <Text style={styles.error}>{save.error instanceof Error ? save.error.message : 'Could not save the test.'}</Text> : null}
    </> : null}
  </Screen>;
}

function Field({label, hint, action, children}: {label: string; hint?: string; action?: ReactNode; children: ReactNode}) {
  return <View style={styles.field}>
    <View style={styles.fieldHead}>
      <View style={{flex: 1, minWidth: 0}}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {action}
    </View>
    {children}
  </View>;
}

function Segmented<T extends string>({items, value, onChange}: {items: {value: T; label: string}[]; value: T; onChange: (value: T) => void}) {
  return <View style={styles.segmented}>
    {items.map(item => {
      const on = item.value === value;
      return <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{selected: on}} onPress={() => onChange(item.value)} style={[styles.segment, on && styles.segmentOn]}>
        <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{item.label}</Text>
      </Pressable>;
    })}
  </View>;
}

function Summary({icon, label, value}: {icon: 'book-outline' | 'language-outline' | 'help-circle-outline' | 'pricetags-outline'; label: string; value: string}) {
  return <View style={styles.summary}>
    <Ionicons name={icon} size={17} color={colors.muted}/>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue} numberOfLines={1}>{value}</Text>
  </View>;
}

const styles = StyleSheet.create({
  progress: {flexDirection: 'row', gap: 6},
  progressStep: {flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border}, progressOn: {backgroundColor: colors.primary},
  field: {gap: 10, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  fieldHead: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  label: {fontSize: 15, fontWeight: '800', color: colors.ink},
  hint: {fontSize: 12, lineHeight: 18, color: colors.muted},
  link: {fontSize: 13, fontWeight: '700', color: colors.primary},
  error: {fontSize: 13, lineHeight: 19, color: colors.red},
  input: {minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, fontSize: 16, color: colors.ink},
  segmented: {flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14, backgroundColor: colors.primarySoft},
  segment: {flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6},
  segmentOn: {backgroundColor: colors.card, elevation: 1, shadowColor: '#000', shadowOpacity: .06, shadowRadius: 4, shadowOffset: {width: 0, height: 1}},
  segmentText: {fontSize: 13, fontWeight: '600', color: colors.muted}, segmentTextOn: {color: colors.ink, fontWeight: '800'},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  subject: {flexGrow: 1, flexBasis: '46%', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, padding: 10, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card},
  subjectOn: {borderColor: colors.primary, backgroundColor: colors.primarySoft},
  subjectIcon: {width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  subjectText: {flex: 1, fontSize: 13, lineHeight: 17, fontWeight: '600', color: colors.ink},
  counts: {flexDirection: 'row', gap: 8},
  count: {flex: 1, alignItems: 'center', gap: 2, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card},
  countOn: {borderColor: colors.primary, backgroundColor: colors.primarySoft},
  countNumber: {fontSize: 24, fontWeight: '900', color: colors.ink}, countNote: {fontSize: 11, color: colors.muted},
  wrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  topic: {flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', minHeight: 40, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  topicOn: {borderColor: colors.primary, backgroundColor: colors.primarySoft},
  topicText: {flexShrink: 1, fontSize: 13, color: colors.ink},
  ready: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#A7D7BF', backgroundColor: colors.greenSoft},
  readyTitle: {fontSize: 16, fontWeight: '800', color: colors.ink},
  notice: {gap: 4, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#F5D28A', backgroundColor: '#FFF8E6'},
  noticeBad: {borderColor: '#F3C1B6', backgroundColor: colors.redSoft},
  noticeTitle: {fontSize: 14, fontWeight: '800', color: colors.ink}, noticeText: {fontSize: 12, lineHeight: 18, color: colors.ink},
  problem: {fontSize: 12, lineHeight: 18, color: colors.red},
  upload: {alignItems: 'center', gap: 6, paddingVertical: 24, paddingHorizontal: 16, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary + '66', backgroundColor: colors.primarySoft},
  uploadTitle: {fontSize: 16, fontWeight: '800', color: colors.primary},
  card: {gap: 12, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  cardHead: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  aiIcon: {width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3FF'},
  promptBox: {padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background},
  promptText: {fontSize: 12, lineHeight: 18, color: colors.ink},
  pasteToggle: {flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36},
  paste: {minHeight: 130, maxHeight: 240, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, fontSize: 13, color: colors.ink},
  summary: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border},
  summaryLabel: {width: 84, fontSize: 13, color: colors.muted}, summaryValue: {flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink, textAlign: 'right'},
  stepper: {flexDirection: 'row', alignItems: 'center', gap: 12},
  stepButton: {width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card},
  stepValue: {flex: 1, alignItems: 'center'}, stepNumber: {fontSize: 30, fontWeight: '900', color: colors.ink},
  footer: {flexDirection: 'row', gap: 10},
  footerSide: {flex: 1}, footerMain: {flex: 2},
});
