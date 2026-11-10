import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Heading } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { vault } from '@/services/vault';
import { examService } from '@/services/exam-service';
import { examDrafts } from '@/services/exam-drafts';
import type { ExamDraft } from '@/store/exam';

/** A mock test saved part-way on this phone, with a button to resume it. Shown on the Roadmap tab. */
export function ResumeMockBanner() {
  const {user} = useAuth();
  const [draft, setDraft] = useState<Pick<ExamDraft, 'id' | 'kind'> | null>(null);
  useFocusEffect(useCallback(() => {
    let alive = true;
    void (async () => {
      const active = await vault.read<ExamDraft>('active-exam');
      if (active?.kind === 'mock' && active.userId === user?.id) {
        const {state} = await examDrafts.load(active.userId, 'mock', active.id, async () => ({status: (await examService.get(active.id)).attempt.status}));
        if (!state || state.status === 'in_progress') { if (alive) setDraft(active); return; }
      }
      if (alive) setDraft(null);
    })().catch(() => { if (alive) setDraft(null); });
    return () => { alive = false; };
  }, [user?.id]));
  if (!draft) return null;
  return <View style={styles.resume}>
    <Heading>Saved mock test</Heading>
    <Button icon="play-outline" label="Resume" onPress={() => router.push({pathname: '/exam', params: {kind: 'mock', id: draft.id}})}/>
  </View>;
}
const styles = StyleSheet.create({
  resume: {padding: 14, gap: 10, borderRadius: 18, borderWidth: 1, borderColor: '#E4CFA9', backgroundColor: '#FAF5EB'},
});
