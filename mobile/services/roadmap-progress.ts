// The roadmap's start date and ticked days, per medium, on this device only
// (as the website keeps them in the browser). Stored in the encrypted vault.
import { vault } from './vault';
import type { PlanMedium } from '@/types/learning';

export interface RoadmapProgress { start: string | null; done: number[] }
const key = (medium: PlanMedium) => `roadmap.${medium}`;

export const roadmapProgress = {
  async read(medium: PlanMedium): Promise<RoadmapProgress> {
    try {
      const saved = await vault.read<RoadmapProgress>(key(medium));
      return { start: typeof saved?.start === 'string' ? saved.start : null, done: Array.isArray(saved?.done) ? saved.done.filter(n => Number.isInteger(n)) : [] };
    } catch { return { start: null, done: [] }; }
  },
  async write(medium: PlanMedium, progress: RoadmapProgress) {
    try { await vault.write(key(medium), progress); } catch { /* Not remembered this time; the plan still works. */ }
  },
};
