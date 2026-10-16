// Exam roadmap: the 90-day plan (per medium) and the exam pattern & syllabus.
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
    {/* The medium sets the plan's topics and the syllabus language. */}
    <View style={styles.mediumRow}>
      <Text style={styles.muted}>Medium</Text>
      <Segmented small value={medium} onChange={setMedium} items={[{value: 'telugu', label: 'Telugu'}, {value: 'english', label: 'English'}]}/>
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

  return <>
    {noteError ? <Text style={styles.error}>{noteError}</Text> : null}
    {/* Today */}
    {!loaded ? <Loading/> : !progress.start ? <Card>
      <Heading>Start your 90-day plan</Heading>
      <Body>Each day shows what to study, with its study notes to read in the app, also offline.</Body>
      <Button icon="play-outline" label="Start today" onPress={() => setStart(isoDate(today))}/>
    </Card> : <View style={[styles.today, current !== null && {borderColor: colors.primary}]}>
      {current !== null ? <>
        <Text style={styles.eyebrow}>Today · {shortDate(today)} · Day {current} of {days.length}</Text>
        <DayContent day={days[current - 1]} large/>
        <DayActions day={days[current - 1]} medium={medium} done={done.has(current)} onToggle={toggle} notes={notesFor(days[current - 1])} large/>
      </> : <Heading>{todayNumber !== null && todayNumber < 1 ? `Starts in ${1 - todayNumber} day${todayNumber === 0 ? '' : 's'}` : '90 days complete'}</Heading>}
      <View style={styles.progressFooter}>
        <View style={styles.startRow}>
          <Text style={styles.muted}>Started {shortDate(parseIso(progress.start))}</Text>
          <View style={styles.inline}>
            <IconButton icon="remove" label="Start one day earlier" onPress={() => setStart(shiftIso(progress.start!, -1))}/>
            <IconButton icon="add" label="Start one day later" onPress={() => setStart(shiftIso(progress.start!, 1))}/>
            <IconButton icon="refresh" label="Restart from today" onPress={() => setStart(isoDate(today))}/>
          </View>
        </View>
        <View style={styles.bar}><View style={[styles.barFill, {width: `${Math.round(done.size / days.length * 100)}%`}]}/></View>
        <Text style={styles.muted}>{done.size}/{days.length} days done</Text>
      </View>
    </View>}

    {/* Every day */}
    <View style={styles.habits}>
      <View style={styles.inline}><Ionicons name="flame-outline" size={16} color="#F97316"/><Text style={styles.habitTitle}>Every day</Text></View>
      {roadmap.habits.map(h => <Text key={h} style={styles.habit}>• {h}</Text>)}
    </View>

    {/* Schedule */}
    <View style={{gap: 10}}>
      <Heading>Schedule</Heading>
      <View style={styles.wrap}>
        {roadmap.parts.map(p => <View key={p.part} style={styles.partChip}>
          <Text style={styles.partText}><Text style={styles.partLabel}>{p.label}</Text> {p.marks}M · {p.days}d{p.extra ?? ''}</Text>
        </View>)}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStrip}>
        {roadmap.phases.map(phase => <View key={phase.phase} style={{gap: 6}}>
          <Text style={styles.phaseLabel}><Text style={styles.partLabel}>{phase.title}</Text> · {phase.days}</Text>
          <View style={styles.inline}>
            {weeks.map((w, i) => {
              if (w[0]?.phase !== phase.phase) return null;
              const n = i + 1; const selected = n === week;
              const complete = w.every(d => done.has(d.day)); const isCurrent = current !== null && Math.ceil(current / 7) === n;
              return <Pressable key={n} accessibilityRole="button" accessibilityLabel={`Week ${n}${isCurrent ? ', this week' : ''}`} accessibilityState={{selected}} onPress={() => setWeek(n)}
                style={[styles.weekButton, complete && styles.weekDone, selected && styles.weekSelected]}>
                {complete && !selected ? <Ionicons name="checkmark" size={18} color={colors.green}/> : <Text style={[styles.weekText, selected && {color: '#fff'}]}>{n}</Text>}
                {isCurrent ? <View style={styles.currentDot}/> : null}
              </Pressable>;
            })}
          </View>
        </View>)}
      </ScrollView>

      <View style={styles.weekCard}>
        <View style={styles.weekHeader}>
          <View style={{flex: 1, minWidth: 0}}>
            <Text style={styles.weekTitle}>Week {week}</Text>
            <Text style={styles.muted}>Days {shown[0]?.day}–{shown[shown.length - 1]?.day}{startTime !== null && shown.length ? ` · ${shortDate(dateOf(shown[0].day)!)} – ${shortDate(dateOf(shown[shown.length - 1].day)!)}` : ''}</Text>
          </View>
          <IconButton icon="chevron-back" label="Previous week" disabled={week === 1} onPress={() => setWeek(week - 1)}/>
          <IconButton icon="chevron-forward" label="Next week" disabled={week === weeks.length} onPress={() => setWeek(week + 1)}/>
        </View>
        {shown.map(d => {
          const date = dateOf(d.day);
          return <View key={d.day} style={[styles.dayRow, d.day === current && styles.dayToday]}>
            <View style={styles.dayHead}>
              <Text style={styles.dayNumber}>Day {d.day}</Text>
              {date !== null ? <Text style={styles.muted}>{shortDate(date)}</Text> : null}
              {d.day === current ? <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>Today</Text></View> : null}
            </View>
            <DayContent day={d}/>
            {loaded ? <DayActions day={d} medium={medium} done={done.has(d.day)} onToggle={toggle} notes={notesFor(d)}/> : null}
          </View>;
        })}
      </View>
    </View>
  </>;
}

function DayContent({day, large}: {day: RoadmapDay; large?: boolean}) {
  return <View style={{gap: 5}}>
    <View style={styles.inline}><View style={[styles.dot, {backgroundColor: SUBJECT_COLOR[day.subject]}]}/><Text style={styles.subject}>{day.subject_label}</Text></View>
    <Text style={large ? styles.titleLarge : styles.title}>{day.title}</Text>
    {day.topics.map(t => <Text key={t} style={large ? styles.topicLarge : styles.topic}>• {t}</Text>)}
    {day.task ? <Text style={styles.task}>{day.task}</Text> : null}
  </View>;
}

/** Opens a downloaded PDF in the app's viewer, which reads it from the phone. */
const readNote = (note: RoadmapNote) =>
  router.push({pathname: '/pdf/[id]', params: {id: note.id, title: note.title, access: note.access, size: String(note.size_bytes)}});

type NotesState = {state: 'locked' | 'saved' | 'saving' | 'download' | 'soon'; onPress: () => void};
const NOTES_LABEL = {locked: showsPlans ? 'Unlock study notes' : 'Study notes · Pro', saved: 'Read study notes', saving: 'Downloading…', download: 'Download study notes', soon: 'Study notes · coming soon'} as const;
const NOTES_ICON = {locked: 'lock-closed', saved: 'book', download: 'download-outline', soon: 'time-outline'} as const;

/** Study notes first and full width; then Done, and Mock tests / Progress on those days. */
function DayActions({day, done, onToggle, notes, large}: {day: RoadmapDay; medium: PlanMedium; done: boolean; onToggle: (day: number) => void; notes: NotesState | null; large?: boolean}) {
  const link = ACTION[day.action];
  const locked = notes?.state === 'locked';
  const soon = notes?.state === 'soon';
  return <View style={[styles.actions, large && {marginTop: 8}]}>
    {notes ? <Pressable accessibilityRole="button" accessibilityLabel={`${NOTES_LABEL[notes.state]}, day ${day.day}`}
      disabled={soon || notes.state === 'saving' || (locked && !showsPlans)} onPress={notes.onPress}
      style={({pressed}) => [styles.notesButton, large && styles.notesButtonLarge, locked && styles.notesLocked, soon && styles.notesSoon, pressed && {opacity: .8}]}>
      {notes.state === 'saving' ? <ActivityIndicator size="small" color="#fff"/>
        : <Ionicons name={NOTES_ICON[notes.state]} size={large ? 20 : 18} color={locked ? colors.gold : soon ? colors.muted : '#fff'}/>}
      <Text style={[styles.notesText, large && {fontSize: 16}, locked && {color: colors.gold}, soon && {color: colors.muted}]}>{NOTES_LABEL[notes.state]}</Text>
      {notes.state === 'saved' ? <View style={styles.offlineTag}><Text style={styles.offlineText}>Offline</Text></View> : null}
    </Pressable> : null}
    <View style={styles.inline}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{checked: done}} accessibilityLabel={`Day ${day.day} done`} onPress={() => onToggle(day.day)}
        style={[styles.pill, done && styles.pillDone]}>
        <Ionicons name={done ? 'checkbox' : 'square-outline'} size={18} color={done ? colors.green : colors.muted}/>
        <Text style={[styles.pillText, done && {color: colors.green}]}>{done ? 'Done' : 'Mark done'}</Text>
      </Pressable>
      {link ? <Pressable accessibilityRole="link" onPress={() => router.push(link.href)} style={[styles.pill, styles.pillLink]}>
        <Text style={[styles.pillText, {color: colors.primary}]}>{link.label}</Text>
        <Ionicons name="arrow-forward" size={15} color={colors.primary}/>
      </Pressable> : null}
    </View>
  </View>;
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
  inline: {flexDirection: 'row', alignItems: 'center', gap: 8},
  wrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  segmented: {flexDirection: 'row', flexGrow: 1, padding: 4, gap: 4, borderRadius: 16, backgroundColor: colors.primarySoft},
  segment: {flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12},
  segmentSmall: {flex: 0, minHeight: 36},
  segmentActive: {backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: .06, shadowRadius: 4, shadowOffset: {width: 0, height: 1}, elevation: 1},
  segmentText: {fontSize: 13, fontWeight: '600', color: colors.muted}, segmentTextActive: {color: colors.ink, fontWeight: '700'},
  mediumRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10},
  today: {padding: 16, gap: 10, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  eyebrow: {fontSize: 12, fontWeight: '700', color: colors.primary},
  progressFooter: {gap: 8, marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border},
  startRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8},
  bar: {height: 6, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden'}, barFill: {height: 6, backgroundColor: colors.primary},
  habits: {padding: 14, gap: 4, borderRadius: 18, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA'},
  habitTitle: {fontSize: 13, fontWeight: '700', color: colors.ink}, habit: {fontSize: 12, lineHeight: 19, color: colors.muted},
  partChip: {paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  partText: {fontSize: 11, color: colors.muted}, partLabel: {fontWeight: '700', color: colors.ink},
  weekStrip: {gap: 16, paddingVertical: 4},
  phaseLabel: {fontSize: 11, color: colors.muted},
  weekButton: {width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center'},
  weekDone: {borderColor: '#A7D7BF', backgroundColor: colors.greenSoft}, weekSelected: {borderColor: colors.primary, backgroundColor: colors.primary},
  weekText: {fontSize: 14, fontWeight: '700', color: colors.ink},
  currentDot: {position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: '#F97316', borderWidth: 2, borderColor: colors.background},
  weekCard: {borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden'},
  weekHeader: {flexDirection: 'row', alignItems: 'center', gap: 6, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border},
  weekTitle: {fontSize: 15, fontWeight: '800', color: colors.ink},
  dayRow: {padding: 14, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border}, dayToday: {backgroundColor: colors.primarySoft},
  dayHead: {flexDirection: 'row', alignItems: 'center', gap: 8},
  dayNumber: {fontSize: 14, fontWeight: '800', color: colors.ink},
  todayBadge: {paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.primary}, todayBadgeText: {fontSize: 10, fontWeight: '700', color: '#fff'},
  dot: {width: 8, height: 8, borderRadius: 4}, subject: {fontSize: 12, fontWeight: '600', color: colors.muted},
  title: {fontSize: 15, lineHeight: 22, fontWeight: '700', color: colors.ink}, titleLarge: {fontSize: 19, lineHeight: 27, fontWeight: '800', color: colors.ink},
  topic: {fontSize: 13, lineHeight: 20, color: colors.muted}, topicLarge: {fontSize: 14, lineHeight: 22, color: colors.muted},
  task: {fontSize: 12, lineHeight: 18, fontWeight: '600', color: colors.ink, marginTop: 2},
  actions: {gap: 10},
  pill: {flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 38, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  pillDone: {borderColor: '#A7D7BF', backgroundColor: colors.greenSoft},
  pillLink: {borderColor: colors.primary},
  notesButton: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.primary},
  notesButtonLarge: {minHeight: 56, borderRadius: 16},
  notesLocked: {backgroundColor: '#FCF4E6', borderWidth: 1, borderColor: '#F3DFB8'},
  notesSoon: {backgroundColor: colors.background, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border},
  notesText: {fontSize: 15, fontWeight: '800', color: '#fff'},
  offlineTag: {paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, backgroundColor: 'rgba(255,255,255,.22)'},
  offlineText: {fontSize: 10, fontWeight: '800', color: '#fff'},
  error: {fontSize: 13, lineHeight: 19, color: colors.red}, pillText: {fontSize: 13, fontWeight: '700', color: colors.muted},
  iconButton: {width: 36, height: 36, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center'},
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
