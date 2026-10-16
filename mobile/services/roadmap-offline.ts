// The roadmap, also without internet: each successful load is kept in the
// encrypted vault, per medium, and the last copy is shown when the phone is
// offline. With it the plan and each day's downloaded study notes (opened from
// the app's private storage) work offline.
import { vault } from './vault';
import { roadmapService } from './learning-service';
import type { PlanMedium, Roadmap } from '@/types/learning';

const key = (medium: PlanMedium) => `roadmap.cache.${medium}`;

export async function loadRoadmap(medium: PlanMedium): Promise<Roadmap> {
  try {
    const roadmap = await roadmapService.get(medium);
    void vault.write(key(medium), roadmap).catch(() => { /* Not kept this time; online still works. */ });
    return roadmap;
  } catch (err) {
    const saved = await vault.read<Roadmap>(key(medium)).catch(() => null);
    if (saved?.days?.length) return saved;
    throw err;
  }
}
