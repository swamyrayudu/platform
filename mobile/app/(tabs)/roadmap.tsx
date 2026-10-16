// Exam roadmap: the 90-day plan (per medium) and the exam pattern & syllabus.
// The plan reads top to bottom: progress, today's study, the week picker and
// that week's days. Each day is one card: what to study, its study notes (the
// main button) and a tick to mark it done.
// The content comes from the website (/api/dsc-sgt/roadmap), so it matches
// the website and updates without an app release. The start date and ticked
// days stay on this device, per medium. The last roadmap is kept on the phone
// (services/roadmap-offline.ts), so the plan opens offline too. A day's Notes
// downloads its study PDF into the app once (it then also appears under
// Resources > Downloaded) and opens it, with or without internet.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Card, Body, Button, Loading, ErrorState, Stats, Heading } from '@/components/ui';
import { BackHeader } from '@/components/back-header';
import { useAuth } from '@/store/auth';
import { loadRoadmap } from '@/services/roadmap-offline';
import { pdfDownloads } from '@/services/pdf-downloads';
import { showsPlans } from '@/services/payment-service';
import { ApiError } from '@/services/api-client';
import { hasActiveSubscription } from '@/utils/subscription';
import { roadmapProgress, type RoadmapProgress } from '@/services/roadmap-progress';
import { DAY_MS, dayStart, isoDate, parseIso, planDayNumber, shiftIso, shortDate, weeksOf } from '@/utils/roadmap';
import { colors } from '@/utils/theme';
import type { PlanAction, PlanMedium, PlanSubject, Roadmap, RoadmapDay, RoadmapNote, SyllabusPart, SyllabusUnit } from '@/types/learning';

const SUBJECT_COLOR: Record<PlanSubject, string> = {
  psychology: '#8B5CF6', perspectives: '#C026D3', mathematics: '#3B82F6', telugu: '#F97316', science: '#10B981',
  english: '#0EA5E9', social: '#F59E0B', gk: '#14B8A6', test: '#65A30D', mock: '#F43F5E', revision: '#94A3B8', rest: '#A1A1AA',
};
/** Mock and review days link to their screen; study days have their notes instead. */
const ACTION: Partial<Record<PlanAction, {label: string; href: '/mocks' | '/performance'}>> = {
  mock: {label: 'Mock tests', href: '/mocks'}, performance: {label: 'Progress', href: '/performance'},
};

type Tab = 'plan' | 'exam';

export default function RoadmapScreen() {
  const {user} = useAuth();
  const [tab, setTab] = useState<Tab>('plan');
  const [medium, setMedium] = useState<PlanMedium>(user?.educationMedium === 'telugu' ? 'telugu' : 'english');
  const roadmap = useQuery({queryKey: ['roadmap', medium], queryFn: () => loadRoadmap(medium), staleTime: 60 * 60 * 1000});
  return <Screen title="Exam roadmap" refreshing={roadmap.isRefetching} onRefresh={() => void roadmap.refetch()}
    pageHeader={<BackHeader title="Exam roadmap" subtitle="AP DSC 2026 · SGT" fallback="/more"/>}>
    <Segmented value={tab} onChange={setTab} items={[{value: 'plan', label: 'Study plan'}, {value: 'exam', label: 'Exam pattern'}]}/>
    {/* The medium sets the plan's topics, its notes and the syllabus language. */}
    <View style={styles.mediumRow}>
      <Text style={styles.mediumLabel}>Medium</Text>
      <Segmented small value={medium} onChange={setMedium} items={[{value: 'telugu', label: 'తెలుగు'}, {value: 'english', label: 'English'}]}/>
    </View>
    {roadmap.isPending ? <Loading/> : null}
    {roadmap.error ? <ErrorState error={roadmap.error} retry={() => void roadmap.refetch()}/> : null}
    {roadmap.data ? (tab === 'plan' ? <StudyPlan key={medium} roadmap={roadmap.data} medium={medium}/> : <ExamPattern roadmap={roadmap.data} medium={medium}/>) : null}
  </Screen>;
}

function Segmented<T extends string>({items, value, onChange, small}: {items: {value: T; label: string}[]; value: T; onChange: (value: T) => void; small?: boolean}) {
  return <View style={[styles.segmented, small && {flexGrow: 0}]}>
    {items.map(item => {
      const active = item.value === value;
      return <Pressable key={item.value} accessibilityRole="tab" accessibilityState={{selected: active}} onPress={() => onChange(item.value)}
        style={[styles.segment, small && styles.segmentSmall, active && styles.segmentActive]}>
        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{item.label}</Text>
      </Pressable>;
    })}
  </View>;
}

function StudyPlan({roadmap, medium}: {roadmap: Roadmap; medium: PlanMedium}) {
  const days = roadmap.days;
  const weeks = useMemo(() => weeksOf(days), [days]);
  const [today] = useState(() => dayStart(Date.now()));
  const [progress, setProgress] = useState<RoadmapProgress>({start: null, done: []});
  // Nothing can be ticked until the saved progress is read, or a quick tap would overwrite it.
  const [loaded, setLoaded] = useState(false);
  const [week, setWeek] = useState(1);

  // Study notes: downloaded once into the app, then opened from there (offline too).
  const {user} = useAuth();
  const pro = hasActiveSubscription(user);
  const cache = useQueryClient();
  const saved = useQuery({queryKey: ['pdf-downloads'], queryFn: pdfDownloads.list});
  const savedIds = new Set((saved.data ?? []).map(d => d.id));
  const [noteError, setNoteError] = useState<string | null>(null);
  const download = useMutation({
    mutationFn: (note: RoadmapNote) => pdfDownloads.download({id: note.id, title: note.title, access: note.access, size_bytes: note.size_bytes}),
    onMutate: () => setNoteError(null),
    onSuccess: (_, note) => { void cache.invalidateQueries({queryKey: ['pdf-downloads']}); readNote(note); },
    onError: err => setNoteError(err instanceof ApiError && err.code === 'PRO_REQUIRED' ? 'These notes are for Pro members.'
      : err instanceof ApiError && err.status === 0 ? 'No internet. Connect once to download these notes; after that they open offline.'
      : err instanceof Error ? err.message : 'Could not download these notes.'),
  });
  const notesFor = (d: RoadmapDay): NotesState | null => {
    const note = d.notes;
    // null: the server has no notes for this day yet (older servers send nothing).
    if (note === null && d.subject !== 'mock' && d.subject !== 'rest') return {state: 'soon', onPress: () => {}};
    if (!note) return null;
    const state = note.access === 'pro' && !pro ? 'locked' : savedIds.has(note.id) ? 'saved' : download.isPending && download.variables?.id === note.id ? 'saving' : 'download';
    const onPress = () => state === 'locked' ? (showsPlans ? router.push('/subscription') : undefined)
      : state === 'saved' ? readNote(note) : state === 'download' ? download.mutate(note) : undefined;
    return {state, onPress};
  };

  useEffect(() => {
    let live = true;
    void roadmapProgress.read(medium).then(saved => {
      if (!live) return;
      setProgress(saved);
      setLoaded(true);
      const n = saved.start ? planDayNumber(saved.start, today) : 0;
      if (n >= 1 && n <= days.length) setWeek(Math.ceil(n / 7));
    });
    return () => { live = false; };
  }, [medium, today, days.length]);

  const save = (next: RoadmapProgress) => { setProgress(next); void roadmapProgress.write(medium, next); };
  const setStart = (start: string | null) => {
    save({...progress, start});
    const n = start ? planDayNumber(start, today) : 0;
    setWeek(n >= 1 && n <= days.length ? Math.ceil(n / 7) : 1);
  };
  const toggle = (day: number) => save({...progress, done: progress.done.includes(day) ? progress.done.filter(d => d !== day) : [...progress.done, day]});

  const done = new Set(progress.done);
  const todayNumber = progress.start ? planDayNumber(progress.start, today) : null;
  const current = todayNumber !== null && todayNumber >= 1 && todayNumber <= days.length ? todayNumber : null;
  const startTime = progress.start ? parseIso(progress.start) : null;
  const dateOf = (day: number) => startTime === null ? null : startTime + (day - 1) * DAY_MS;
  const shown = weeks[week - 1] ?? [];

  const [editStart, setEditStart] = useState(false);
  const phaseOf = (w: number) => roadmap.phases.find(p => p.phase === weeks[w - 1]?.[0]?.phase);
  const percent = Math.round(done.size / days.length * 100);

  if (!loaded) return <Loading/>;
  return <>
    {noteError ? <Text style={styles.error}>{noteError}</Text> : null}

    {/* Progress */}
    {!progress.start ? <Card>
      <Heading>Start your 90-day plan</Heading>
      <Body>Every day shows what to study and its study notes. Download the notes once and read them even without internet.</Body>
      <Button icon="play-outline" label="Start today" onPress={() => setStart(isoDate(today))}/>
    </Card> : <View style={styles.progress}>
      <View style={styles.progressTop}>
        <View style={{flex: 1, minWidth: 0}}>
          <Text style={styles.progressDay}>{current !== null ? `Day ${current}` : todayNumber !== null && todayNumber < 1 ? `Starts in ${1 - todayNumber} day${todayNumber === 0 ? '' : 's'}` : 'Plan complete'}<Text style={styles.progressOf}>{current !== null ? ` of ${days.length}` : ''}</Text></Text>
          <Text style={styles.muted}>{done.size} of {days.length} days done · {percent}%</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setEditStart(!editStart)} hitSlop={6} style={styles.changeLink}>
          <Ionicons name="calendar-outline" size={15} color={colors.primary}/>
          <Text style={styles.changeText}>{editStart ? 'Close' : 'Start date'}</Text>
        </Pressable>
      </View>
      <View style={styles.bar}><View style={[styles.barFill, {width: `${percent}%`}]}/></View>
      {editStart ? <View style={styles.startEditor}>
        <Text style={styles.muted}>Started on <Text style={styles.strong}>{shortDate(parseIso(progress.start))}</Text></Text>
        <View style={styles.inline}>
          <SmallButton label="− 1 day" onPress={() => setStart(shiftIso(progress.start!, -1))}/>
          <SmallButton label="+ 1 day" onPress={() => setStart(shiftIso(progress.start!, 1))}/>
          <SmallButton label="From today" onPress={() => setStart(isoDate(today))}/>
        </View>
      </View> : null}
    </View>}

    {/* Today */}
    {current !== null ? <View style={{gap: 8}}>
      <Text style={styles.sectionTitle}>Today · {shortDate(today)}</Text>
      <DayCard day={days[current - 1]} date={null} done={done.has(current)} onToggle={toggle} notes={notesFor(days[current - 1])} highlight/>
    </View> : null}

    {/* Weeks */}
    <View style={{gap: 10}}>
      <Text style={styles.sectionTitle}>All 90 days</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStrip}>
        {weeks.map((w, i) => {
          const n = i + 1; const selected = n === week;
          const complete = w.every(d => done.has(d.day)); const isCurrent = current !== null && Math.ceil(current / 7) === n;
          return <Pressable key={n} accessibilityRole="button" accessibilityLabel={`Week ${n}${isCurrent ? ', this week' : ''}${complete ? ', done' : ''}`} accessibilityState={{selected}} onPress={() => setWeek(n)}
            style={[styles.weekChip, complete && styles.weekDone, selected && styles.weekSelected]}>
            {complete && !selected ? <Ionicons name="checkmark-circle" size={15} color={colors.green}/> : null}
            <Text style={[styles.weekText, selected && {color: '#fff'}]}>Week {n}</Text>
            {isCurrent ? <View style={[styles.currentDot, selected && {backgroundColor: '#fff'}]}/> : null}
          </Pressable>;
        })}
      </ScrollView>
      <View style={styles.weekHeader}>
        <IconButton icon="chevron-back" label="Previous week" disabled={week === 1} onPress={() => setWeek(week - 1)}/>
        <View style={{flex: 1, minWidth: 0, alignItems: 'center'}}>
          <Text style={styles.weekTitle}>Week {week}{phaseOf(week) ? ` · ${phaseOf(week)!.title}` : ''}</Text>
          <Text style={styles.muted}>Days {shown[0]?.day}–{shown[shown.length - 1]?.day}{startTime !== null && shown.length ? ` · ${shortDate(dateOf(shown[0].day)!)} – ${shortDate(dateOf(shown[shown.length - 1].day)!)}` : ''}</Text>
        </View>
        <IconButton icon="chevron-forward" label="Next week" disabled={week === weeks.length} onPress={() => setWeek(week + 1)}/>
      </View>
      {shown.map(d => <DayCard key={d.day} day={d} date={dateOf(d.day)} today={d.day === current} done={done.has(d.day)} onToggle={toggle} notes={notesFor(d)}/>)}
    </View>
  </>;
}

/** One day: number and date with a tick to mark it done, the subject, title and topics, then its study notes. */
function DayCard({day, date, today, done, onToggle, notes, highlight}: {day: RoadmapDay; date: number | null; today?: boolean; done: boolean; onToggle: (day: number) => void; notes: NotesState | null; highlight?: boolean}) {
  const link = ACTION[day.action];
  return <View style={[styles.dayCard, (highlight || today) && styles.dayCardToday, done && styles.dayCardDone]}>
    <View style={styles.dayHead}>
      <View style={[styles.dayBadge, {backgroundColor: SUBJECT_COLOR[day.subject]}]}><Text style={styles.dayBadgeText}>{day.day}</Text></View>
      <View style={{flex: 1, minWidth: 0}}>
        <Text style={styles.subject} numberOfLines={1}>{day.subject_label}{date !== null ? ` · ${shortDate(date)}` : ''}</Text>
        {today ? <Text style={styles.todayTag}>Today</Text> : null}
      </View>
      <Pressable accessibilityRole="checkbox" accessibilityState={{checked: done}} accessibilityLabel={`Mark day ${day.day} done`} hitSlop={8} onPress={() => onToggle(day.day)}
        style={[styles.tick, done && styles.tickDone]}>
        <Ionicons name="checkmark" size={18} color={done ? '#fff' : colors.border}/>
      </Pressable>
    </View>
    <Text style={highlight ? styles.titleLarge : styles.title}>{day.title}</Text>
    <View style={{gap: 3}}>
      {day.topics.map(t => <View key={t} style={styles.topicRow}><View style={styles.topicDot}/><Text style={highlight ? styles.topicLarge : styles.topic}>{t}</Text></View>)}
    </View>
    {day.task ? <Text style={styles.task}>{day.task}</Text> : null}
    {notes ? <NotesButton notes={notes} large={highlight}/> : null}
    {link ? <Pressable accessibilityRole="link" onPress={() => router.push(link.href)} style={({pressed}) => [styles.linkButton, pressed && {opacity: .7}]}>
      <Text style={styles.linkText}>{link.label}</Text>
      <Ionicons name="arrow-forward" size={16} color={colors.primary}/>
    </Pressable> : null}
  </View>;
}

function SmallButton({label, onPress}: {label: string; onPress: () => void}) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({pressed}) => [styles.smallButton, pressed && {opacity: .6}]}>
    <Text style={styles.smallButtonText}>{label}</Text>
  </Pressable>;
}

/** Opens a downloaded PDF in the app's viewer, which reads it from the phone. */
const readNote = (note: RoadmapNote) =>
  router.push({pathname: '/pdf/[id]', params: {id: note.id, title: note.title, access: note.access, size: String(note.size_bytes)}});

type NotesState = {state: 'locked' | 'saved' | 'saving' | 'download' | 'soon'; onPress: () => void};
const NOTES_LABEL = {locked: showsPlans ? 'Unlock study notes' : 'Study notes · Pro', saved: 'Read study notes', saving: 'Downloading…', download: 'Download study notes', soon: 'Study notes · coming soon'} as const;
const NOTES_ICON = {locked: 'lock-closed', saved: 'book', download: 'download-outline', soon: 'time-outline'} as const;

/** The day's study notes: download once, then read in the app, offline too. */
function NotesButton({notes, large}: {notes: NotesState; large?: boolean}) {
  const locked = notes.state === 'locked';
  const soon = notes.state === 'soon';
  return <Pressable accessibilityRole="button" accessibilityLabel={NOTES_LABEL[notes.state]}
    disabled={soon || notes.state === 'saving' || (locked && !showsPlans)} onPress={notes.onPress}
    style={({pressed}) => [styles.notesButton, large && styles.notesButtonLarge, locked && styles.notesLocked, soon && styles.notesSoon, pressed && {opacity: .8}]}>
    {notes.state === 'saving' ? <ActivityIndicator size="small" color="#fff"/>
      : <Ionicons name={NOTES_ICON[notes.state]} size={large ? 20 : 18} color={locked ? colors.gold : soon ? colors.muted : '#fff'}/>}
    <Text style={[styles.notesText, large && {fontSize: 16}, locked && {color: colors.gold}, soon && {color: colors.muted}]}>{NOTES_LABEL[notes.state]}</Text>
    {notes.state === 'saved' ? <View style={styles.offlineTag}><Ionicons name="cloud-done-outline" size={12} color="#fff"/><Text style={styles.offlineText}>Offline</Text></View> : null}
  </Pressable>;
}

function IconButton({icon, label, onPress, disabled}: {icon: 'add' | 'remove' | 'refresh' | 'chevron-back' | 'chevron-forward' | 'close'; label: string; onPress: () => void; disabled?: boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} hitSlop={4} onPress={onPress}
    style={({pressed}) => [styles.iconButton, disabled && {opacity: .35}, pressed && {opacity: .6}]}>
    <Ionicons name={icon} size={18} color={colors.primary}/>
  </Pressable>;
}

/** The older server shape (units as plain lines), for before the full syllabus is deployed. */
function fallbackSyllabus(roadmap: Roadmap): SyllabusPart[] {
  const q = (marks: number) => Math.round(marks / roadmap.exam.pattern.marks_per_question);
  return roadmap.exam.parts.map(p => ({
    id: p.id, name: p.name, teluguName: p.teluguName ?? p.name, marks: p.marks, questions: q(p.marks), split: p.split, note: p.note,
    content: p.units.map(u => ({title: u, topics: []})), methodology: p.methodologyUnits?.map(u => ({title: u, topics: []})),
  }));
}

function UnitList({heading, units}: {heading: string; units: SyllabusUnit[]}) {
  return <View style={{gap: 8}}>
    <Text style={styles.unitHeading}>{heading}</Text>
    {units.map((u, i) => <View key={u.title} style={styles.unitCard}>
      <Text style={styles.unitTitle}><Text style={styles.unitNumber}>{i + 1}. </Text>{u.title}</Text>
      {u.topics.map(t => <View key={t} style={styles.topicRow}><Text style={styles.bullet}>•</Text><Text style={styles.topicText}>{t}</Text></View>)}
    </View>)}
  </View>;
}

function ExamPattern({roadmap, medium}: {roadmap: Roadmap; medium: PlanMedium}) {
  const {pattern, dates, dates_updated, source, facts} = roadmap.exam;
  const parts = roadmap.exam.syllabus ?? fallbackSyllabus(roadmap);
  const telugu = medium === 'telugu';
  const [open, setOpen] = useState<string | null>(null);
  const q = (marks: number) => Math.round(marks / pattern.marks_per_question);
  const updated = new Date(parseIso(dates_updated)).toLocaleDateString('en-IN', {day: 'numeric', month: 'long', year: 'numeric'});
  return <>
    <Stats items={[
      {label: 'questions', value: pattern.total_questions},
      {label: 'marks', value: pattern.total_marks},
      {label: 'minutes', value: pattern.duration_minutes},
      {label: pattern.negative_marks ? `mark each · −${pattern.negative_marks} if wrong` : 'mark each · no negative', value: pattern.marks_per_question === 0.5 ? '½' : pattern.marks_per_question},
    ]}/>
    {facts?.length ? <Card>
      <Heading>Pattern details</Heading>
      {facts.map(f => <View key={f.label} style={styles.fact}>
        <Text style={styles.factLabel}>{f.label}</Text>
        <Text style={styles.factValue}>{f.value}</Text>
      </View>)}
    </Card> : null}
    <Card>
      <Heading>Marks by part</Heading>
      {parts.map(p => <View key={p.id} style={styles.markRow}>
        <View style={{flex: 1, minWidth: 0}}>
          <Text style={styles.markName}>{p.name}</Text>
          {telugu ? <Text style={styles.muted}>{p.teluguName}</Text> : null}
          <Text style={styles.muted}>{p.questions} questions{p.split ? ` · content ${p.split.content}M (${q(p.split.content)} Q) + methodology ${p.split.methodology}M (${q(p.split.methodology)} Q)` : ''}</Text>
        </View>
        <Text style={styles.markValue}>{p.marks}</Text>
      </View>)}
      <View style={[styles.markRow, {borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10}]}>
        <Text style={[styles.markName, {flex: 1}]}>Total</Text>
        <Text style={styles.markValue}>{parts.reduce((sum, p) => sum + p.marks, 0)}</Text>
      </View>
    </Card>
    <View style={{gap: 10}}>
      <Heading>Full syllabus</Heading>
      <Text style={styles.muted}>Every unit and topic of the official syllabus{telugu ? ', in Telugu' : ''}. Tap a part to open it.</Text>
      {parts.map(p => {
        const expanded = open === p.id;
        const unitCount = p.content.length + (p.methodology?.length ?? 0);
        return <View key={p.id} style={styles.syllabus}>
          <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={() => setOpen(expanded ? null : p.id)} style={styles.syllabusHead}>
            <View style={{flex: 1, minWidth: 0}}>
              <Text style={styles.markName}>{p.name}</Text>
              {telugu ? <Text style={styles.muted}>{p.teluguName}</Text> : null}
              <Text style={styles.muted}>{p.marks} marks · {p.questions} questions · {unitCount} unit{unitCount === 1 ? '' : 's'}</Text>
            </View>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted}/>
          </Pressable>
          {expanded ? <View style={styles.syllabusBody}>
            {p.note ? <Text style={styles.note}>{p.note}</Text> : null}
            {p.content.length ? <UnitList heading={p.split ? `Content · ${p.split.content} marks · ${q(p.split.content)} questions` : 'Units'} units={p.content}/> : null}
            {p.methodology?.length ? <UnitList heading={`Teaching methodology${p.split ? ` · ${p.split.methodology} marks · ${q(p.split.methodology)} questions` : ''}`} units={p.methodology}/> : null}
          </View> : null}
        </View>;
      })}
      <Text style={styles.muted}>Source: {source}.</Text>
    </View>
    <Card>
      <View style={styles.inline}><Ionicons name="calendar-outline" size={18} color={colors.primary}/><Heading>Important dates</Heading></View>
      {dates.map(d => <View key={d.label} style={styles.markRow}>
        <Text style={[styles.markName, {flex: 1}]}>{d.label}</Text>
        <Text style={d.date ? styles.markName : styles.muted}>{d.date ? new Date(parseIso(d.date)).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}) : 'To be announced'}</Text>
      </View>)}
      <Text style={styles.muted}>Updated {updated}. Confirm in the official notification.</Text>
    </Card>
  </>;
}

const styles = StyleSheet.create({
  muted: {fontSize: 12, lineHeight: 18, color: colors.muted},
  strong: {fontWeight: '700', color: colors.ink},
  inline: {flexDirection: 'row', alignItems: 'center', gap: 8},
  error: {fontSize: 13, lineHeight: 19, color: colors.red},
  // Header
  segmented: {flexDirection: 'row', flexGrow: 1, padding: 4, gap: 4, borderRadius: 16, backgroundColor: colors.primarySoft},
  segment: {flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12},
  segmentSmall: {flex: 0, minHeight: 34, paddingHorizontal: 14},
  segmentActive: {backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: .06, shadowRadius: 4, shadowOffset: {width: 0, height: 1}, elevation: 1},
  segmentText: {fontSize: 13, fontWeight: '600', color: colors.muted}, segmentTextActive: {color: colors.ink, fontWeight: '700'},
  mediumRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10},
  mediumLabel: {fontSize: 13, fontWeight: '600', color: colors.muted},
  // Progress
  progress: {padding: 16, gap: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  progressTop: {flexDirection: 'row', alignItems: 'center', gap: 10},
  progressDay: {fontSize: 22, fontWeight: '800', color: colors.ink}, progressOf: {fontSize: 15, fontWeight: '600', color: colors.muted},
  changeLink: {flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.primarySoft},
  changeText: {fontSize: 12, fontWeight: '700', color: colors.primary},
  bar: {height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden'}, barFill: {height: 8, borderRadius: 4, backgroundColor: colors.primary},
  startEditor: {gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border},
  smallButton: {paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background},
  smallButtonText: {fontSize: 12, fontWeight: '700', color: colors.ink},
  sectionTitle: {fontSize: 12, fontWeight: '800', letterSpacing: .6, textTransform: 'uppercase', color: colors.muted},
  // Weeks
  weekStrip: {gap: 8, paddingVertical: 2, paddingRight: 8},
  weekChip: {flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 38, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  weekDone: {borderColor: '#A7D7BF', backgroundColor: colors.greenSoft}, weekSelected: {borderColor: colors.primary, backgroundColor: colors.primary},
  weekText: {fontSize: 13, fontWeight: '700', color: colors.ink},
  currentDot: {width: 7, height: 7, borderRadius: 4, backgroundColor: '#F97316'},
  weekHeader: {flexDirection: 'row', alignItems: 'center', gap: 8},
  weekTitle: {fontSize: 15, fontWeight: '800', color: colors.ink},
  // Day card
  dayCard: {padding: 14, gap: 9, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  dayCardToday: {borderColor: colors.primary, borderWidth: 1.5},
  dayCardDone: {backgroundColor: '#FBFCFB'},
  dayHead: {flexDirection: 'row', alignItems: 'center', gap: 10},
  dayBadge: {width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center'},
  dayBadgeText: {fontSize: 14, fontWeight: '800', color: '#fff'},
  subject: {fontSize: 12, fontWeight: '700', color: colors.muted},
  todayTag: {fontSize: 11, fontWeight: '800', color: colors.primary},
  tick: {width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card},
  tickDone: {borderColor: colors.green, backgroundColor: colors.green},
  title: {fontSize: 16, lineHeight: 23, fontWeight: '800', color: colors.ink}, titleLarge: {fontSize: 19, lineHeight: 27, fontWeight: '800', color: colors.ink},
  topicDot: {width: 5, height: 5, borderRadius: 3, marginTop: 8, backgroundColor: colors.muted},
  topic: {flex: 1, fontSize: 13, lineHeight: 20, color: colors.muted}, topicLarge: {flex: 1, fontSize: 14, lineHeight: 22, color: colors.muted},
  task: {fontSize: 12, lineHeight: 18, fontWeight: '600', color: colors.ink},
  notesButton: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, marginTop: 4, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.primary},
  notesButtonLarge: {minHeight: 56, borderRadius: 16},
  notesLocked: {backgroundColor: '#FCF4E6', borderWidth: 1, borderColor: '#F3DFB8'},
  notesSoon: {backgroundColor: colors.background, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border},
  notesText: {fontSize: 15, fontWeight: '800', color: '#fff'},
  offlineTag: {flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, backgroundColor: 'rgba(255,255,255,.22)'},
  offlineText: {fontSize: 10, fontWeight: '800', color: '#fff'},
  linkButton: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 46, marginTop: 4, borderRadius: 14, borderWidth: 1, borderColor: colors.primary},
  linkText: {fontSize: 14, fontWeight: '700', color: colors.primary},
  iconButton: {width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center'},
  markRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  markName: {fontSize: 14, lineHeight: 21, fontWeight: '600', color: colors.ink}, markValue: {fontSize: 16, fontWeight: '800', color: colors.primary},
  syllabus: {borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden'},
  syllabusHead: {flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 60},
  syllabusBody: {paddingHorizontal: 14, paddingBottom: 14, gap: 5},
  unitHeading: {fontSize: 11, fontWeight: '800', letterSpacing: .4, textTransform: 'uppercase', color: colors.primary, marginTop: 8},
  unitCard: {padding: 12, gap: 5, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background},
  unitTitle: {fontSize: 14, lineHeight: 21, fontWeight: '700', color: colors.ink}, unitNumber: {color: colors.muted},
  topicRow: {flexDirection: 'row', gap: 7}, bullet: {fontSize: 13, lineHeight: 20, color: colors.muted},
  topicText: {flex: 1, fontSize: 13, lineHeight: 20, color: colors.muted},
  note: {fontSize: 12, lineHeight: 18, color: colors.muted, padding: 10, borderRadius: 12, backgroundColor: colors.background},
  fact: {gap: 2, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border},
  factLabel: {fontSize: 11, fontWeight: '700', letterSpacing: .4, textTransform: 'uppercase', color: colors.muted},
  factValue: {fontSize: 14, lineHeight: 21, color: colors.ink},
});
