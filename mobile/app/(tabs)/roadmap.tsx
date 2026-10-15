// Exam roadmap: the 90-day plan (per medium) and the exam pattern & syllabus.
// The content comes from the website (/api/dsc-sgt/roadmap), so it matches
// the website and updates without an app release. The start date and ticked
// days stay on this device, per medium.
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, Card, Body, Button, Loading, ErrorState, Stats, Heading } from '@/components/ui';
import { BackHeader } from '@/components/back-header';
import { useAuth } from '@/store/auth';
import { roadmapService } from '@/services/learning-service';
import { roadmapProgress, type RoadmapProgress } from '@/services/roadmap-progress';
import { DAY_MS, dayStart, isoDate, parseIso, planDayNumber, shiftIso, shortDate, weeksOf } from '@/utils/roadmap';
import { colors } from '@/utils/theme';
import type { PlanAction, PlanMedium, PlanSubject, Roadmap, RoadmapDay } from '@/types/learning';

const SUBJECT_COLOR: Record<PlanSubject, string> = {
  psychology: '#8B5CF6', perspectives: '#C026D3', mathematics: '#3B82F6', telugu: '#F97316', science: '#10B981',
  english: '#0EA5E9', social: '#F59E0B', gk: '#14B8A6', test: '#65A30D', mock: '#F43F5E', revision: '#94A3B8', rest: '#A1A1AA',
};
const ACTION: Record<Exclude<PlanAction, 'none'>, {label: string; href: '/practice' | '/mocks' | '/performance'}> = {
  practice: {label: 'Practice', href: '/practice'}, mock: {label: 'Mock tests', href: '/mocks'}, performance: {label: 'Progress', href: '/performance'},
};

type Tab = 'plan' | 'exam';

export default function RoadmapScreen() {
  const {user} = useAuth();
  const [tab, setTab] = useState<Tab>('plan');
  const [medium, setMedium] = useState<PlanMedium>(user?.educationMedium === 'telugu' ? 'telugu' : 'english');
  const roadmap = useQuery({queryKey: ['roadmap', medium], queryFn: () => roadmapService.get(medium), staleTime: 60 * 60 * 1000});
  return <Screen title="Exam roadmap" refreshing={roadmap.isRefetching} onRefresh={() => void roadmap.refetch()}
    pageHeader={<BackHeader title="Exam roadmap" subtitle="AP DSC 2026 · SGT" fallback="/more"/>}>
    <Segmented value={tab} onChange={setTab} items={[{value: 'plan', label: 'Study plan'}, {value: 'exam', label: 'Exam pattern'}]}/>
    {tab === 'plan' ? <View style={styles.mediumRow}>
      <Text style={styles.muted}>Medium</Text>
      <Segmented small value={medium} onChange={setMedium} items={[{value: 'telugu', label: 'Telugu'}, {value: 'english', label: 'English'}]}/>
    </View> : null}
    {roadmap.isPending ? <Loading/> : null}
    {roadmap.error ? <ErrorState error={roadmap.error} retry={() => void roadmap.refetch()}/> : null}
    {roadmap.data ? (tab === 'plan' ? <StudyPlan key={medium} roadmap={roadmap.data} medium={medium}/> : <ExamPattern roadmap={roadmap.data}/>) : null}
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
  const [prompt, setPrompt] = useState<RoadmapDay | null>(null);

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
    {/* Today */}
    {!loaded ? <Loading/> : !progress.start ? <Card>
      <Heading>Start your 90-day plan</Heading>
      <Body>Each day shows what to study, with practice and an AI study prompt.</Body>
      <Button icon="play-outline" label="Start today" onPress={() => setStart(isoDate(today))}/>
    </Card> : <View style={[styles.today, current !== null && {borderColor: colors.primary}]}>
      {current !== null ? <>
        <Text style={styles.eyebrow}>Today · {shortDate(today)} · Day {current} of {days.length}</Text>
        <DayContent day={days[current - 1]} large/>
        <DayActions day={days[current - 1]} done={done.has(current)} onToggle={toggle} onPrompt={setPrompt} large/>
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
            {loaded ? <DayActions day={d} done={done.has(d.day)} onToggle={toggle} onPrompt={setPrompt}/> : null}
          </View>;
        })}
      </View>
    </View>
    {prompt ? <PromptSheet day={prompt} onClose={() => setPrompt(null)}/> : null}
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

function DayActions({day, done, onToggle, onPrompt, large}: {day: RoadmapDay; done: boolean; onToggle: (day: number) => void; onPrompt: (day: RoadmapDay) => void; large?: boolean}) {
  return <View style={[styles.actions, large && {marginTop: 6}]}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{checked: done}} accessibilityLabel={`Day ${day.day} done`} onPress={() => onToggle(day.day)}
      style={[styles.pill, done && styles.pillDone]}>
      <Ionicons name={done ? 'checkbox' : 'square-outline'} size={17} color={done ? colors.green : colors.muted}/>
      <Text style={[styles.pillText, done && {color: colors.green}]}>Done</Text>
    </Pressable>
    {day.action !== 'none' ? <Pressable accessibilityRole="link" onPress={() => router.push(ACTION[day.action as Exclude<PlanAction, 'none'>].href)}
      style={[styles.pill, large && styles.pillPrimary]}>
      <Text style={[styles.pillText, {color: large ? '#fff' : colors.primary}]}>{ACTION[day.action].label}</Text>
      <Ionicons name="arrow-forward" size={15} color={large ? '#fff' : colors.primary}/>
    </Pressable> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={`AI study prompt for day ${day.day}`} onPress={() => onPrompt(day)} style={[styles.pill, styles.pillAi]}>
      <Ionicons name="sparkles-outline" size={15} color="#7C3AED"/>
      <Text style={[styles.pillText, {color: '#6D28D9'}]}>AI prompt</Text>
    </Pressable>
  </View>;
}

function PromptSheet({day, onClose}: {day: RoadmapDay; onClose: () => void}) {
  const share = () => { void Share.share({message: day.prompt}); };
  return <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
    <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose}/>
    <SafeAreaView edges={['bottom']} style={styles.sheet}>
      <View style={styles.handle}/>
      <View style={styles.sheetHeader}>
        <View style={{flex: 1, minWidth: 0}}>
          <Heading>AI study prompt</Heading>
          <Text style={styles.muted}>Day {day.day} · {day.title}</Text>
        </View>
        <IconButton icon="close" label="Close" onPress={onClose}/>
      </View>
      <ScrollView style={styles.promptBox} contentContainerStyle={{padding: 12}}>
        <Text selectable style={styles.promptText}>{day.prompt}</Text>
      </ScrollView>
      <Button icon="share-outline" label="Send to an AI app" onPress={share}/>
      <Text style={styles.hint}>Choose ChatGPT, Gemini or Claude, or Copy and paste it in. AI can make mistakes: check facts against your textbooks.</Text>
    </SafeAreaView>
  </Modal>;
}

function IconButton({icon, label, onPress, disabled}: {icon: 'add' | 'remove' | 'refresh' | 'chevron-back' | 'chevron-forward' | 'close'; label: string; onPress: () => void; disabled?: boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} hitSlop={4} onPress={onPress}
    style={({pressed}) => [styles.iconButton, disabled && {opacity: .35}, pressed && {opacity: .6}]}>
    <Ionicons name={icon} size={18} color={colors.primary}/>
  </Pressable>;
}

function ExamPattern({roadmap}: {roadmap: Roadmap}) {
  const {pattern, parts, dates, dates_updated, source} = roadmap.exam;
  const [open, setOpen] = useState<string | null>(null);
  const questions = (marks: number) => Math.round(marks / pattern.marks_per_question);
  const updated = new Date(parseIso(dates_updated)).toLocaleDateString('en-IN', {day: 'numeric', month: 'long', year: 'numeric'});
  return <>
    <Stats items={[
      {label: 'questions', value: pattern.total_questions},
      {label: 'marks', value: pattern.total_marks},
      {label: 'minutes', value: pattern.duration_minutes},
      {label: pattern.negative_marks ? `mark each · −${pattern.negative_marks} if wrong` : 'mark each · no negative', value: pattern.marks_per_question === 0.5 ? '½' : pattern.marks_per_question},
    ]}/>
    <Card>
      <Heading>Marks by part</Heading>
      {parts.map(p => <View key={p.id} style={styles.markRow}>
        <View style={{flex: 1, minWidth: 0}}>
          <Text style={styles.markName}>{p.name}</Text>
          <Text style={styles.muted}>{questions(p.marks)} questions{p.split ? ` · content ${p.split.content} + methodology ${p.split.methodology}` : ''}</Text>
        </View>
        <Text style={styles.markValue}>{p.marks}</Text>
      </View>)}
      <View style={[styles.markRow, {borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10}]}>
        <Text style={[styles.markName, {flex: 1}]}>Total</Text>
        <Text style={styles.markValue}>{parts.reduce((sum, p) => sum + p.marks, 0)}</Text>
      </View>
    </Card>
    <View style={{gap: 10}}>
      <Heading>Syllabus</Heading>
      {parts.map(p => {
        const expanded = open === p.id;
        return <View key={p.id} style={styles.syllabus}>
          <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={() => setOpen(expanded ? null : p.id)} style={styles.syllabusHead}>
            <View style={{flex: 1, minWidth: 0}}>
              <Text style={styles.markName}>{p.name}</Text>
              <Text style={styles.muted}>{p.marks} marks · {questions(p.marks)} questions</Text>
            </View>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted}/>
          </Pressable>
          {expanded ? <View style={styles.syllabusBody}>
            {p.note ? <Text style={styles.muted}>{p.note}</Text> : null}
            {p.units.length ? <><Text style={styles.unitHeading}>{p.split ? `Content · ${p.split.content} marks` : 'Units'}</Text>{p.units.map(u => <Text key={u} style={styles.topic}>• {u}</Text>)}</> : null}
            {p.methodologyUnits ? <><Text style={styles.unitHeading}>Methodology{p.split ? ` · ${p.split.methodology} marks` : ''}</Text>{p.methodologyUnits.map(u => <Text key={u} style={styles.topic}>• {u}</Text>)}</> : null}
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
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  pill: {flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 38, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  pillDone: {borderColor: '#A7D7BF', backgroundColor: colors.greenSoft}, pillPrimary: {borderColor: colors.primary, backgroundColor: colors.primary},
  pillAi: {borderColor: '#DDD6FE', backgroundColor: '#F5F3FF'}, pillText: {fontSize: 13, fontWeight: '700', color: colors.muted},
  iconButton: {width: 36, height: 36, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center'},
  backdrop: {flex: 1, backgroundColor: 'rgba(27,26,46,.45)'},
  sheet: {maxHeight: '85%', padding: 18, paddingTop: 10, gap: 12, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.card},
  handle: {alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border},
  sheetHeader: {flexDirection: 'row', alignItems: 'center', gap: 10},
  promptBox: {flexGrow: 0, maxHeight: 340, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background},
  promptText: {fontSize: 12, lineHeight: 19, color: colors.ink},
  hint: {fontSize: 11, lineHeight: 17, color: colors.muted, textAlign: 'center'},
  markRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  markName: {fontSize: 14, lineHeight: 21, fontWeight: '600', color: colors.ink}, markValue: {fontSize: 16, fontWeight: '800', color: colors.primary},
  syllabus: {borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden'},
  syllabusHead: {flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 60},
  syllabusBody: {paddingHorizontal: 14, paddingBottom: 14, gap: 5},
  unitHeading: {fontSize: 12, fontWeight: '700', color: colors.ink, marginTop: 6},
});
