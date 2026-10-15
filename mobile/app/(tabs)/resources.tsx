// Resources: PDFs the admin uploads (books, study material, bit banks).
// Folders the admin made (e.g. "Previous papers") come first, then files in
// no folder; opening a folder shows its files. In the app a PDF is downloaded
// once into the app's private storage, then opened from there (/pdf/[id],
// screenshots blocked) with or without internet. Downloads are listed under
// Downloaded even when offline. (The website reads PDFs directly instead.)
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListScreen, Loading, ErrorState, EmptyState } from '@/components/ui';
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

const CATEGORIES: {value: ResourceCategory; label: string; icon: 'book-outline' | 'document-text-outline' | 'list-outline' | 'newspaper-outline' | 'folder-outline'}[] = [
  {value: 'book', label: 'Books', icon: 'book-outline'},
  {value: 'study_material', label: 'Study material', icon: 'document-text-outline'},
  {value: 'bit_bank', label: 'Bit banks', icon: 'list-outline'},
  {value: 'previous_paper', label: 'Previous papers', icon: 'newspaper-outline'},
  {value: 'other', label: 'Other', icon: 'folder-outline'},
];
const MEDIUM = {english: 'English medium', telugu: 'Telugu medium', both: 'Both mediums'} as const;

type Row = {kind: 'folder'; folder: ResourceFolder; count: number} | {kind: 'heading'; title: string} | {kind: 'file'; resource: Resource} | {kind: 'saved'; item: DownloadedPdf};

const read = (r: {id: string; title: string; access: 'free' | 'pro'; size_bytes: number}) =>
  router.push({pathname: '/pdf/[id]', params: {id: r.id, title: r.title, access: r.access, size: String(r.size_bytes)}});

export default function Resources() {
  const {user} = useAuth();
  const pro = hasActiveSubscription(user);
  const cache = useQueryClient();
  const list = useQuery({queryKey: ['resources'], queryFn: resourcesService.list});
  const saved = useQuery({queryKey: ['pdf-downloads'], queryFn: pdfDownloads.list});
  const [category, setCategory] = useState<ResourceCategory | 'all'>('all');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const download = useMutation({
    mutationFn: (r: Resource) => pdfDownloads.download({id: r.id, title: r.title, access: r.access, size_bytes: r.size_bytes}),
    onMutate: () => setMessage(null),
    onSuccess: () => { void cache.invalidateQueries({queryKey: ['pdf-downloads']}); },
    onError: err => setMessage(err instanceof ApiError && err.code === 'PRO_REQUIRED' ? 'This resource is for Pro members.' : err instanceof Error ? err.message : 'Could not download this file.'),
  });

  const resources = useMemo(() => list.data?.resources ?? [], [list.data]);
  const folders = useMemo(() => list.data?.folders ?? [], [list.data]);
  const savedList = useMemo(() => saved.data ?? [], [saved.data]);
  const savedIds = new Set(savedList.map(d => d.id));
  const folder = folders.find(f => f.id === folderId) ?? null;
  const inFolder = (r: Resource) => !!r.folder_id && folders.some(f => f.id === r.folder_id);

  // Inside a folder or the Downloaded list, Android back returns to all resources.
  useEffect(() => {
    if (!folder && !showSaved) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setFolderId(null); setShowSaved(false); return true; });
    return () => sub.remove();
  }, [folder, showSaved]);

  const scoped = folder ? resources.filter(r => r.folder_id === folder.id) : resources;
  const matching = scoped.filter(r => category === 'all' || r.category === category);
  const present = CATEGORIES.filter(c => scoped.some(r => r.category === c.value));

  const rows: Row[] = (() => {
    if (showSaved) return savedList.map(item => ({kind: 'saved' as const, item}));
    if (folder) return matching.map(resource => ({kind: 'file' as const, resource}));
    const folderRows: Row[] = folders
      .map(f => ({kind: 'folder' as const, folder: f, count: matching.filter(r => r.folder_id === f.id).length}))
      .filter(f => f.count > 0);
    const files: Row[] = matching.filter(r => !inFolder(r)).map(resource => ({kind: 'file' as const, resource}));
    return [
      ...(folderRows.length ? [{kind: 'heading' as const, title: 'Folders'}, ...folderRows] : []),
      ...(folderRows.length && files.length ? [{kind: 'heading' as const, title: 'Files'}] : []),
      ...files,
    ];
  })();

  const chooseFolder = (id: string | null) => { setFolderId(id); setCategory('all'); };
  const back = () => { setFolderId(null); setShowSaved(false); };

  const header = <View style={{gap: 12}}>
    {folder?.description && !showSaved ? <Text style={styles.folderNote}>{folder.description}</Text> : null}
    {!folder ? <View style={styles.filters}>
      {!showSaved ? [{value: 'all' as const, label: 'All'}, ...(present.length > 1 ? present : [])].map(c => {
        const active = c.value === category;
        return <Pressable key={c.value} accessibilityRole="button" accessibilityState={{selected: active}} onPress={() => setCategory(c.value)} style={[styles.filter, active && styles.filterActive]}>
          <Text style={[styles.filterText, active && {color: colors.primary}]}>{c.label}</Text>
        </Pressable>;
      }) : null}
      <Pressable accessibilityRole="button" accessibilityState={{selected: showSaved}} onPress={() => setShowSaved(!showSaved)} style={[styles.filter, styles.savedFilter, showSaved && styles.filterActive]}>
        <Ionicons name="download" size={14} color={showSaved ? colors.primary : colors.green}/>
        <Text style={[styles.filterText, showSaved && {color: colors.primary}]}>Downloaded{savedList.length ? ` (${savedList.length})` : ''}</Text>
      </Pressable>
    </View> : null}
    {showSaved ? <Text style={styles.folderNote}>Saved inside this app for offline reading. They do not appear in your phone&apos;s files.</Text> : null}
    {message ? <Text style={styles.error}>{message}</Text> : null}
    {!showSaved && list.isPending ? <Loading/> : null}
    {!showSaved && list.error ? <ErrorState error={list.error} retry={() => void list.refetch()}/> : null}
  </View>;

  return <ListScreen title="Resources" data={rows} keyExtractor={(row, i) => row.kind === 'file' ? row.resource.id : row.kind === 'saved' ? `saved-${row.item.id}` : row.kind === 'folder' ? `folder-${row.folder.id}` : `heading-${i}`}
    pageHeader={folder || showSaved
      ? <BackHeader title={showSaved ? 'Downloaded' : folder!.name} subtitle={showSaved ? `${savedList.length} saved in the app` : `${scoped.length} file${scoped.length === 1 ? '' : 's'} · Resources`} fallback="/resources" onBack={back}/>
      : <BackHeader title="Resources" subtitle="Books, study material and previous papers" fallback="/more"/>}
    header={header} refreshing={list.isRefetching} onRefresh={() => { void list.refetch(); void saved.refetch(); }}
    empty={showSaved
      ? <EmptyState icon="download-outline" title="Nothing downloaded yet" detail="Tap Download on a resource to read it here without internet."/>
      : list.data ? <EmptyState icon="library-outline" title={folder ? 'No files here' : 'No resources yet'} detail={folder ? 'Files added to this folder will appear here.' : 'Books and study material will appear here when they are added.'}/> : null}
    extraData={[download.variables?.id, savedList.length]}
    renderItem={({item}) => item.kind === 'heading'
      ? <Text style={styles.heading}>{item.title}</Text>
      : item.kind === 'folder'
        ? <FolderCard folder={item.folder} count={item.count} onOpen={() => chooseFolder(item.folder.id)}/>
        : item.kind === 'saved'
          ? <SavedCard item={item.item} locked={item.item.access === 'pro' && !pro}/>
          : <ResourceCard resource={item.resource} locked={item.resource.access === 'pro' && !pro} saved={savedIds.has(item.resource.id)}
            downloading={download.isPending && download.variables?.id === item.resource.id} onDownload={() => download.mutate(item.resource)}/>}/>;
}

function FolderCard({folder, count, onOpen}: {folder: ResourceFolder; count: number; onOpen: () => void}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Folder ${folder.name}, ${count} files. Open`} onPress={onOpen}
    style={({pressed}) => [styles.card, styles.folderCard, pressed && {opacity: .75}]}>
    <View style={[styles.icon, styles.folderIcon]}><Ionicons name="folder" size={22} color="#D97706"/></View>
    <View style={[styles.copy, {justifyContent: 'center'}]}>
      <Text style={styles.title} numberOfLines={1}>{folder.name}</Text>
      <Text style={styles.meta} numberOfLines={1}>{count} file{count === 1 ? '' : 's'}{folder.description ? ` · ${folder.description}` : ''}</Text>
    </View>
    <Ionicons name="chevron-forward" size={19} color={colors.muted} style={{alignSelf: 'center'}}/>
  </Pressable>;
}

function ResourceCard({resource, locked, saved, downloading, onDownload}: {resource: Resource; locked: boolean; saved: boolean; downloading: boolean; onDownload: () => void}) {
  const category = CATEGORIES.find(c => c.value === resource.category) ?? CATEGORIES[4];
  return <View style={styles.card}>
    <View style={styles.icon}><Ionicons name={category.icon} size={22} color={colors.primary}/></View>
    <View style={styles.copy}>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2}>{resource.title}</Text>
        {resource.access === 'pro' ? <View style={styles.pro}><Ionicons name="ribbon" size={11} color={colors.gold}/><Text style={styles.proText}>Pro</Text></View> : null}
      </View>
      {resource.description ? <Text style={styles.description} numberOfLines={2}>{resource.description}</Text> : null}
      <Text style={styles.meta}>{[category.label, resource.subject, MEDIUM[resource.medium], `PDF · ${sizeText(resource.size_bytes)}`].filter(Boolean).join(' · ')}</Text>
      {locked ? <Pressable accessibilityRole="button" disabled={!showsPlans} onPress={() => router.push('/subscription')} style={[styles.action, styles.actionLocked]}>
        <Ionicons name="lock-closed" size={15} color={colors.gold}/>
        <Text style={[styles.actionText, {color: colors.gold}]}>{showsPlans ? 'Unlock with Pro' : 'Pro members only'}</Text>
      </Pressable> : <View style={styles.actions}>
        {/* Download once into the app, then Open works without internet. */}
        {saved ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${resource.title}`} onPress={() => read(resource)} style={[styles.action, styles.actionPrimary]}>
          <Ionicons name="book-outline" size={15} color="#fff"/><Text style={[styles.actionText, {color: '#fff'}]}>Open</Text>
        </Pressable> : <Pressable accessibilityRole="button" accessibilityLabel={`Download ${resource.title} into the app`} disabled={downloading} onPress={onDownload} style={[styles.action, styles.actionPrimary, downloading && {opacity: .7}]}>
          {downloading ? <ActivityIndicator size="small" color="#fff"/> : <Ionicons name="download-outline" size={15} color="#fff"/>}
          <Text style={[styles.actionText, {color: '#fff'}]}>{downloading ? 'Downloading…' : 'Download'}</Text>
        </Pressable>}
        {saved ? <View style={styles.savedTag}><Ionicons name="checkmark-circle" size={14} color={colors.green}/><Text style={styles.savedText}>Works offline</Text></View> : null}
      </View>}
    </View>
  </View>;
}

function SavedCard({item, locked}: {item: DownloadedPdf; locked: boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Read ${item.title}`} disabled={locked} onPress={() => read(item)} style={({pressed}) => [styles.card, pressed && {opacity: .75}]}>
    <View style={[styles.icon, {backgroundColor: colors.greenSoft}]}><Ionicons name="document-lock-outline" size={22} color={colors.green}/></View>
    <View style={[styles.copy, {justifyContent: 'center'}]}>
      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.meta}>{locked ? 'Pro membership needed to read' : `PDF · ${sizeText(item.size_bytes)} · works offline`}</Text>
    </View>
    <Ionicons name={locked ? 'lock-closed' : 'chevron-forward'} size={19} color={locked ? colors.gold : colors.muted} style={{alignSelf: 'center'}}/>
  </Pressable>;
}

const styles = StyleSheet.create({
  filters: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  filter: {minHeight: 38, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, justifyContent: 'center'},
  savedFilter: {flexDirection: 'row', alignItems: 'center', gap: 5},
  filterActive: {borderColor: colors.primary, backgroundColor: colors.primarySoft},
  filterText: {fontSize: 13, fontWeight: '600', color: colors.muted},
  folderNote: {fontSize: 13, lineHeight: 19, color: colors.muted},
  error: {fontSize: 13, color: colors.red},
  heading: {fontSize: 13, fontWeight: '800', color: colors.ink, marginTop: 4, marginBottom: 8},
  card: {flexDirection: 'row', gap: 12, padding: 14, marginBottom: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
  folderCard: {minHeight: 72},
  icon: {width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft},
  folderIcon: {backgroundColor: '#FEF3C7'},
  copy: {flex: 1, minWidth: 0, gap: 5},
  titleRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 8},
  title: {flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '700', color: colors.ink},
  pro: {flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: '#FCF4E6'},
  proText: {fontSize: 11, fontWeight: '700', color: colors.gold},
  description: {fontSize: 13, lineHeight: 19, color: colors.muted},
  meta: {fontSize: 11, lineHeight: 17, color: colors.muted},
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4},
  action: {alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, minHeight: 36, borderRadius: 11, backgroundColor: colors.primarySoft},
  actionPrimary: {backgroundColor: colors.primary},
  savedTag: {flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36},
  savedText: {fontSize: 12, fontWeight: '600', color: colors.green},
  actionLocked: {marginTop: 4, backgroundColor: '#FCF4E6'},
  actionText: {fontSize: 12, fontWeight: '700', color: colors.primary},
});
