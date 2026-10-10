import { api } from './api-client';
import type { Overview, Performance } from '@/types/analytics';
export const analyticsService = {
  overview: () => api.request<Overview>('/api/dsc-sgt/overview'),
  performance: () => api.request<Performance>('/api/dsc-sgt/performance'),
};
