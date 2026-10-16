// Resources: PDFs the admin uploads (books, study material, bit banks).
// The top level loads only folders (with file counts) and files in no folder;
// a folder's files load when it is opened, and back (header or Android)
// returns to Resources. Files come in reading order (Day 1 → Day 28). In the
// app a PDF is downloaded once into the app's private storage, then opened
// from there (/pdf/[id], screenshots blocked) with or without internet.
// Downloads are listed under Downloaded even when offline. (The website reads
// PDFs directly instead.)
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListScreen, ErrorState, EmptyState } from '@/components/ui';
import { BackHeader } from '@/components/back-header';
import { useAuth } from '@/store/auth';
import { resourcesService } from '@/services/learning-service';
import { pdfDownloads, type DownloadedPdf } from '@/services/pdf-downloads';
import { showsPlans } from '@/services/payment-service';
import { ApiError } from '@/services/api-client';
import { hasActiveSubscription } from '@/utils/subscription';
import { sizeText } from '@/utils/roadmap';
import { colors } from '@/utils/theme';
import type { Resource, ResourceCategory, ResourceFolder } from '@/types/learning';

type Medium = 'all' | 'telugu' | 'english';
type Icon = 'book-outline' | 'document-text-outline' | 'list-outline' | 'newspaper-outline' | 'folder-outline';

const CATEGORIES: {value: ResourceCategory; label: string; icon: Icon}[] = [
  {value: 'book', label: 'Books', icon: 'book-outline'},
  {value: 'study_material', label: 'Study material', icon: 'document-text-outline'},
  {value: 'bit_bank', label: 'Bit banks', icon: 'list-outline'},
  {value: 'previous_paper', label: 'Previous papers', icon: 'newspaper-outline'},
  {value: 'other', label: 'Other', icon: 'folder-outline'},
];
const MEDIUMS: {value: Medium; label: string}[] = [{value: 'all', label: 'All'}, {value: 'telugu', label: 'Telugu'}, {value: 'english', label: 'English'}];
const MEDIUM_LABEL = {english: 'English', telugu: 'Telugu', both: 'Telugu & English'} as const;

type Row = {kind: 'folder'; folder: ResourceFolder; count: number} | {kind: 'heading'; title: string} | {kind: 'file'; resource: Resource} | {kind: 'saved'; item: DownloadedPdf};

const fitsMedium = (r: Resource, m: Medium) => m === 'all' || r.medium === 'both' || r.medium === m;
const countFor = (f: ResourceFolder, m: Medium) => m === 'english' ? f.english_count ?? f.file_count : m === 'telugu' ? f.telugu_count ?? f.file_count : f.file_count;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const read = (r: {id: string; title: string; access: 'free' | 'pro'; size_bytes: number}) =>
  router.push({pathname: '/pdf/[id]', params: {id: r.id, title: r.title, access: r.access, size: String(r.size_bytes)}});

export default function Resources() {
  const {user} = useAuth();
  const pro = hasActiveSubscription(user);
  const cache = useQueryClient();
  const [medium, setMedium] = useState<Medium>('all');
  const [category, setCategory] = useState<ResourceCategory | 'all'>('all');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const root = useQuery({queryKey: ['resources', 'root'], queryFn: resourcesService.root});
  // Loaded when a folder is opened; kept, so going back and in again is instant.
  const opened = useQuery({queryKey: ['resources', 'folder', folderId], queryFn: () => resourcesService.folder(folderId!), enabled: !!folderId});
  const saved = useQuery({queryKey: ['pdf-downloads'], queryFn: pdfDownloads.list});
  const download = useMutation({
    mutationFn: (r: Resource) => pdfDownloads.download({id: r.id, title: r.title, access: r.access, size_bytes: r.size_bytes}),
    onMutate: () => setMessage(null),
    onSuccess: () => { void cache.invalidateQueries({queryKey: ['pdf-downloads']}); },
    onError: err => setMessage(err instanceof ApiError && err.code === 'PRO_REQUIRED' ? 'This resource is for Pro members.' : err instanceof Error ? err.message : 'Could not download this file.'),
  });

  const savedList = useMemo(() => saved.data ?? [], [saved.data]);
  const savedIds = new Set(savedList.map(d => d.id));
  const folderInfo = opened.data?.folder ?? root.data?.folders.find(f => f.id === folderId) ?? null;

  const back = () => { setFolderId(null); setShowSaved(false); setCategory('all'); setMessage(null); };
  // This tab keeps its last view (a folder, Downloaded) when the user moves to
  // another tab. Opening Resources again from More starts on the main page;
  // closing a PDF (router.back) keeps the folder the user was reading in.
  const {opened: openedAt} = useLocalSearchParams<{opened?: string}>();
  const [seenOpenedAt, setSeenOpenedAt] = useState(openedAt);
  if (openedAt !== seenOpenedAt) { setSeenOpenedAt(openedAt); back(); }
  // Inside a folder or the Downloaded list, Android back returns to Resources.
  useEffect(() => {
    if (!folderId && !showSaved) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => sub.remove();
  }, [folderId, showSaved]);

  const folderFiles = (opened.data?.resources ?? []).filter(r => fitsMedium(r, medium));
  const present = CATEGORIES.filter(c => folderFiles.some(r => r.category === c.value));

  const rows: Row[] = (() => {
    if (showSaved) return savedList.map(item => ({kind: 'saved' as const, item}));
    if (folderId) return folderFiles.filter(r => category === 'all' || r.category === category).map(resource => ({kind: 'file' as const, resource}));
    if (!root.data) return [];
    const folderRows: Row[] = root.data.folders
      .map(f => ({kind: 'folder' as const, folder: f, count: countFor(f, medium)}))
      .filter(f => f.count > 0);
    const files: Row[] = root.data.resources.filter(r => fitsMedium(r, medium)).map(resource => ({kind: 'file' as const, resource}));
    return [
      ...(folderRows.length ? [{kind: 'heading' as const, title: 'Folders'}, ...folderRows] : []),
      ...(files.length ? [{kind: 'heading' as const, title: folderRows.length ? 'Other files' : 'Files'}, ...files] : []),
    ];
  })();

  const pending = showSaved ? false : folderId ? opened.isPending : root.isPending;
  const failure = showSaved ? null : folderId ? opened.error : root.error;

  const header = <View style={styles.header}>
    {!showSaved ? <View style={styles.segment} accessibilityRole="tablist">
      {MEDIUMS.map(m => {
        const active = m.value === medium;
        return <Pressable key={m.value} accessibilityRole="tab" accessibilityState={{selected: active}} onPress={() => setMedium(m.value)} style={[styles.segmentItem, active && styles.segmentActive]}>
          <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{m.label}</Text>
        </Pressable>;
      })}
    </View> : null}
    {!folderId && !showSaved ? <Pressable accessibilityRole="button" onPress={() => setShowSaved(true)} style={({pressed}) => [styles.savedLink, pressed && {opacity: .7}]}>
      <Ionicons name="download" size={16} color={colors.green}/>
      <Text style={styles.savedLinkText}>Downloaded{savedList.length ? ` · ${savedList.length}` : ''}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.muted}/>
    </Pressable> : null}
    {folderId && present.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {[{value: 'all' as const, label: 'All'}, ...present].map(c => {
        const active = c.value === category;
        const n = c.value === 'all' ? folderFiles.length : folderFiles.filter(r => r.category === c.value).length;
        return <Pressable key={c.value} accessibilityRole="button" accessibilityState={{selected: active}} onPress={() => setCategory(c.value)} style={[styles.chip, active && styles.chipActive]}>
          <Text style={[styles.chipText, active && {color: '#fff'}]}>{c.label} · {n}</Text>
        </Pressable>;
      })}
    </ScrollView> : null}
    {showSaved ? <Text style={styles.note}>Saved inside this app for offline reading. They do not appear in your phone&apos;s files.</Text> : null}
    {folderId && folderInfo?.description ? <Text style={styles.note}>{folderInfo.description}</Text> : null}
    {message ? <Text style={styles.error}>{message}</Text> : null}
    {pending ? <View style={styles.loading}><ActivityIndicator color={colors.primary}/><Text style={styles.loadingText}>{folderId ? 'Loading files…' : 'Loading resources…'}</Text></View> : null}
    {failure ? <ErrorState error={failure} retry={() => void (folderId ? opened.refetch() : root.refetch())}/> : null}
  </View>;

  const title = showSaved ? 'Downloaded' : folderId ? folderInfo?.name ?? 'Folder' : 'Resources';
  const subtitle = showSaved ? `${savedList.length} saved in the app`
    : folderId ? (opened.data ? `${plural(folderFiles.length, 'file')} · Resources` : 'Resources')
    : 'Books, study material and previous papers';

  return <ListScreen title="Resources" data={pending || failure ? [] : rows}
    keyExtractor={(row, i) => row.kind === 'file' ? row.resource.id : row.kind === 'saved' ? `saved-${row.item.id}` : row.kind === 'folder' ? `folder-${row.folder.id}` : `heading-${i}`}
    pageHeader={folderId || showSaved
      ? <BackHeader title={title} subtitle={subtitle} fallback="/resources" onBack={back}/>
      : <BackHeader title={title} subtitle={subtitle} fallback="/more"/>}
    header={header}
    refreshing={folderId ? opened.isRefetching : root.isRefetching}
    onRefresh={() => { void (folderId ? opened.refetch() : root.refetch()); void saved.refetch(); }}
    empty={pending || failure ? null : showSaved
      ? <EmptyState icon="download-outline" title="Nothing downloaded yet" detail="Tap Download on a resource to read it here without internet."/>
      : <EmptyState icon="library-outline" title={folderId ? 'No files here' : 'Nothing here yet'} detail={folderId ? 'No files in this folder for this medium yet.' : 'Books and study material will appear here when they are added.'}/>}
    extraData={[download.variables?.id, savedList.length, medium, category]}
    renderItem={({item}) => item.kind === 'heading'
      ? <Text style={styles.heading}>{item.title}</Text>
      : item.kind === 'folder'
        ? <FolderCard folder={item.folder} count={item.count} onOpen={() => { setCategory('all'); setFolderId(item.folder.id); }}/>
        : item.kind === 'saved'
          ? <SavedCard item={item.item} locked={item.item.access === 'pro' && !pro}/>
          : <ResourceCard resource={item.resource} locked={item.resource.access === 'pro' && !pro} saved={savedIds.has(item.resource.id)}
            downloading={download.isPending && download.variables?.id === item.resource.id} onDownload={() => download.mutate(item.resource)}/>}/>;
}

function FolderCard({folder, count, onOpen}: {folder: ResourceFolder; count: number; onOpen: () => void}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Folder ${folder.name}, ${plural(count, 'file')}. Open`} onPress={onOpen}
    style={({pressed}) => [styles.card, styles.folderCard, pressed && {opacity: .75}]}>
    <View style={[styles.icon, styles.folderIcon]}><Ionicons name="folder" size={22} color="#D97706"/></View>
    <View style={styles.copy}>
      <Text style={styles.title} numberOfLines={1}>{folder.name}</Text>
      <Text style={styles.meta} numberOfLines={1}>{plural(count, 'file')}{folder.description ? ` · ${folder.description}` : ''}</Text>
    </View>
    <Ionicons name="chevron-forward" size={19} color={colors.muted}/>
  </Pressable>;
}

/** One file: the same size everywhere — title in two lines at most, details in one. */
function ResourceCard({resource, locked, saved, downloading, onDownload}: {resource: Resource; locked: boolean; saved: boolean; downloading: boolean; onDownload: () => void}) {
  const category = CATEGORIES.find(c => c.value === resource.category) ?? CATEGORIES[4];
  const details = [category.label, MEDIUM_LABEL[resource.medium], sizeText(resource.size_bytes)].join(' · ');
  return <View style={styles.card}>
    <View style={styles.icon}><Ionicons name={category.icon} size={21} color={colors.primary}/></View>
    <View style={styles.copy}>
      <Text style={[styles.title, styles.fileTitle]} numberOfLines={2}>{resource.title}</Text>
      <View style={styles.metaRow}>
        {resource.access === 'pro' ? <View style={styles.pro}><Ionicons name="ribbon" size={10} color={colors.gold}/><Text style={styles.proText}>PRO</Text></View> : null}
        <Text style={[styles.meta, {flex: 1}]} numberOfLines={1}>{details}</Text>
      </View>
      {saved && !locked ? <View style={styles.savedTag}><Ionicons name="checkmark-circle" size={13} color={colors.green}/><Text style={styles.savedText}>Works offline</Text></View> : null}
    </View>
    {locked ? <Pressable accessibilityRole="button" accessibilityLabel={showsPlans ? 'Unlock with Pro' : 'Pro members only'} disabled={!showsPlans} onPress={() => router.push('/subscription')} style={[styles.action, styles.actionLocked]}>
      <Ionicons name="lock-closed" size={14} color={colors.gold}/>
      <Text style={[styles.actionText, {color: colors.gold}]}>{showsPlans ? 'Unlock' : 'Pro'}</Text>
    </Pressable> : saved
      ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${resource.title}`} onPress={() => read(resource)} style={[styles.action, styles.actionPrimary]}>
        <Ionicons name="book-outline" size={14} color="#fff"/><Text style={[styles.actionText, {color: '#fff'}]}>Open</Text>
      </Pressable>
      // Download once into the app, then Open works without internet.
      : <Pressable accessibilityRole="button" accessibilityLabel={`Download ${resource.title} into the app`} disabled={downloading} onPress={onDownload} style={[styles.action, styles.actionPrimary, downloading && {opacity: .7}]}>
        {downloading ? <ActivityIndicator size="small" color="#fff"/> : <Ionicons name="download-outline" size={14} color="#fff"/>}
        <Text style={[styles.actionText, {color: '#fff'}]}>{downloading ? 'Saving…' : 'Download'}</Text>
      </Pressable>}
  </View>;
}

function SavedCard({item, locked}: {item: DownloadedPdf; locked: boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Read ${item.title}`} disabled={locked} onPress={() => read(item)} style={({pressed}) => [styles.card, pressed && {opacity: .75}]}>
    <View style={[styles.icon, {backgroundColor: colors.greenSoft}]}><Ionicons name="document-lock-outline" size={21} color={colors.green}/></View>
    <View style={styles.copy}>
      <Text style={[styles.title, styles.fileTitle]} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.meta} numberOfLines={1}>{locked ? 'Pro membership needed to read' : `PDF · ${sizeText(item.size_bytes)} · works offline`}</Text>
    </View>
    <Ionicons name={locked ? 'lock-closed' : 'chevron-forward'} size={19} color={locked ? colors.gold : colors.muted}/>
  </Pressable>;
}

const styles = StyleSheet.create({
  header: {gap: 12, marginBottom: 4},
  segment: {flexDirection: 'row', padding: 4, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  segmentItem: {flex: 1, minHeight: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  segmentActive: {backgroundColor: colors.primary},
  segmentText: {fontSize: 13, fontWeight: '600', color: colors.muted},
  segmentTextActive: {color: '#fff'},
  savedLink: {flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  savedLinkText: {flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink},
  chips: {gap: 8, paddingRight: 8},
  chip: {minHeight: 36, paddingHorizontal: 13, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, justifyContent: 'center'},
  chipActive: {borderColor: colors.primary, backgroundColor: colors.primary},
  chipText: {fontSize: 12, fontWeight: '600', color: colors.muted},
  note: {fontSize: 13, lineHeight: 19, color: colors.muted},
  error: {fontSize: 13, color: colors.red},
  loading: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 28},
  loadingText: {fontSize: 13, color: colors.muted},
  heading: {fontSize: 12, fontWeight: '800', letterSpacing: .6, textTransform: 'uppercase', color: colors.muted, marginTop: 10, marginBottom: 8},
  card: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 84, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  folderCard: {minHeight: 72},
  icon: {width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft},
  folderIcon: {backgroundColor: '#FEF3C7'},
  copy: {flex: 1, minWidth: 0, gap: 4},
  title: {fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.ink},
  // Two lines' height whatever the title, so every file card is the same size.
  fileTitle: {minHeight: 40},
  metaRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  pro: {flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, backgroundColor: '#FCF4E6'},
  proText: {fontSize: 10, fontWeight: '800', color: colors.gold},
  meta: {fontSize: 12, lineHeight: 17, color: colors.muted},
  savedTag: {flexDirection: 'row', alignItems: 'center', gap: 4},
  savedText: {fontSize: 11, fontWeight: '600', color: colors.green},
  action: {width: 96, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 11, backgroundColor: colors.primarySoft},
  actionPrimary: {backgroundColor: colors.primary},
  actionLocked: {backgroundColor: '#FCF4E6'},
  actionText: {fontSize: 12, fontWeight: '700', color: colors.primary},
});
