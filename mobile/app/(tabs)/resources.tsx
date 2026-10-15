// Resources: PDFs the admin uploads (books, study material, bit banks).
// Folders the admin made (e.g. "Previous papers") come first, then files in
// no folder; opening a folder shows its files. A PDF opens from a one-hour
// signed link; Pro files are checked on the server.
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ListScreen, Loading, ErrorState, EmptyState } from '@/components/ui';
import { BackHeader } from '@/components/back-header';
import { useAuth } from '@/store/auth';
import { resourcesService } from '@/services/learning-service';
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

type Row = {kind: 'folder'; folder: ResourceFolder; count: number} | {kind: 'heading'; title: string} | {kind: 'file'; resource: Resource};

export default function Resources() {
  const {user} = useAuth();
  const pro = hasActiveSubscription(user);
  const list = useQuery({queryKey: ['resources'], queryFn: resourcesService.list});
  const [category, setCategory] = useState<ResourceCategory | 'all'>('all');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const open = useMutation({
    mutationFn: (id: string) => resourcesService.link(id),
    onMutate: () => setMessage(null),
    onSuccess: ({url}) => { void Linking.openURL(url); },
    onError: err => setMessage(err instanceof ApiError && err.code === 'PRO_REQUIRED' ? 'This resource is for Pro members.' : err instanceof Error ? err.message : 'Could not open this resource.'),
  });

  const resources = useMemo(() => list.data?.resources ?? [], [list.data]);
  const folders = useMemo(() => list.data?.folders ?? [], [list.data]);
  const folder = folders.find(f => f.id === folderId) ?? null;
  const inFolder = (r: Resource) => !!r.folder_id && folders.some(f => f.id === r.folder_id);

  // Inside a folder, Android back closes the folder instead of leaving Resources.
  useEffect(() => {
    if (!folder) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setFolderId(null); return true; });
    return () => sub.remove();
  }, [folder]);

  const scoped = folder ? resources.filter(r => r.folder_id === folder.id) : resources;
  const matching = scoped.filter(r => category === 'all' || r.category === category);
  const present = CATEGORIES.filter(c => scoped.some(r => r.category === c.value));

  const rows: Row[] = (() => {
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

  const header = <View style={{gap: 12}}>
    {folder?.description ? <Text style={styles.folderNote}>{folder.description}</Text> : null}
    {present.length > 1 ? <View style={styles.filters}>
      {[{value: 'all' as const, label: 'All'}, ...present].map(c => {
        const active = c.value === category;
        return <Pressable key={c.value} accessibilityRole="button" accessibilityState={{selected: active}} onPress={() => setCategory(c.value)} style={[styles.filter, active && styles.filterActive]}>
          <Text style={[styles.filterText, active && {color: colors.primary}]}>{c.label}</Text>
        </Pressable>;
      })}
    </View> : null}
    {message ? <Text style={styles.error}>{message}</Text> : null}
    {list.isPending ? <Loading/> : null}
    {list.error ? <ErrorState error={list.error} retry={() => void list.refetch()}/> : null}
  </View>;

  return <ListScreen title="Resources" data={rows} keyExtractor={(row, i) => row.kind === 'file' ? row.resource.id : row.kind === 'folder' ? `folder-${row.folder.id}` : `heading-${i}`}
    pageHeader={folder
      ? <BackHeader title={folder.name} subtitle={`${scoped.length} file${scoped.length === 1 ? '' : 's'} · Resources`} fallback="/resources" onBack={() => chooseFolder(null)}/>
      : <BackHeader title="Resources" subtitle="Books, study material and previous papers" fallback="/more"/>}
    header={header} refreshing={list.isRefetching} onRefresh={() => void list.refetch()}
    empty={list.data ? <EmptyState icon="library-outline" title={folder ? 'No files here' : 'No resources yet'} detail={folder ? 'Files added to this folder will appear here.' : 'Books and study material will appear here when they are added.'}/> : null}
    extraData={open.variables}
    renderItem={({item}) => item.kind === 'heading'
      ? <Text style={styles.heading}>{item.title}</Text>
      : item.kind === 'folder'
        ? <FolderCard folder={item.folder} count={item.count} onOpen={() => chooseFolder(item.folder.id)}/>
        : <ResourceCard resource={item.resource} locked={item.resource.access === 'pro' && !pro} busy={open.isPending && open.variables === item.resource.id} onOpen={() => open.mutate(item.resource.id)}/>}/>;
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

function ResourceCard({resource, locked, busy, onOpen}: {resource: Resource; locked: boolean; busy: boolean; onOpen: () => void}) {
  const category = CATEGORIES.find(c => c.value === resource.category) ?? CATEGORIES[4];
  const press = () => {
    if (!locked) return onOpen();
    if (showsPlans) router.push('/subscription');
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={`${resource.title}. ${locked ? (showsPlans ? 'Pro. Unlock with Pro' : 'Pro members only') : 'Open PDF'}`}
    disabled={busy || (locked && !showsPlans)} onPress={press} style={({pressed}) => [styles.card, pressed && {opacity: .75}]}>
    <View style={styles.icon}><Ionicons name={category.icon} size={22} color={colors.primary}/></View>
    <View style={styles.copy}>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2}>{resource.title}</Text>
        {resource.access === 'pro' ? <View style={styles.pro}><Ionicons name="ribbon" size={11} color={colors.gold}/><Text style={styles.proText}>Pro</Text></View> : null}
      </View>
      {resource.description ? <Text style={styles.description} numberOfLines={2}>{resource.description}</Text> : null}
      <Text style={styles.meta}>{[category.label, resource.subject, MEDIUM[resource.medium], `PDF · ${sizeText(resource.size_bytes)}`].filter(Boolean).join(' · ')}</Text>
      <View style={[styles.action, locked && styles.actionLocked]}>
        <Ionicons name={busy ? 'hourglass-outline' : locked ? 'lock-closed' : 'open-outline'} size={15} color={locked ? colors.gold : colors.primary}/>
        <Text style={[styles.actionText, locked && {color: colors.gold}]}>{busy ? 'Opening…' : locked ? (showsPlans ? 'Unlock with Pro' : 'Pro members only') : 'Open PDF'}</Text>
      </View>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  filters: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  filter: {minHeight: 38, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, justifyContent: 'center'},
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
  action: {alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, paddingHorizontal: 11, minHeight: 34, borderRadius: 10, backgroundColor: colors.primarySoft},
  actionLocked: {backgroundColor: '#FCF4E6'},
  actionText: {fontSize: 12, fontWeight: '700', color: colors.primary},
});
