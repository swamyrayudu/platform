import { api, query } from './api-client';
import type { PracticeFilterState, DynamicFilterOptions, PracticeSession, PracticeHistoryItem, PracticeResultSummary, WeakAreaRecommendation } from '@/types/practice';
const base = '/api/dsc-sgt/practice';
export interface Quota { isPremium: boolean; canPractice: boolean; maxQuestions: number; reason: string | null; completedSessions: number; allowedSessions: number | 'unlimited' }
export interface PracticeFeedback { correct_answer: string | null; explanation: string | null; is_correct: boolean }
export const practiceService = {
  filters: (filter: Partial<PracticeFilterState>) => api.request<{data: DynamicFilterOptions}>(`${base}/filters?${query({medium: filter.medium, subject: filter.subject, class_levels: filter.class_levels, topics: filter.topics, subtopics: filter.subtopics, difficulty: filter.difficulty})}`),
  quota: () => api.request<Quota>(`${base}/quota`),
  weak: () => api.request<{recommendations: WeakAreaRecommendation[]}>(`${base}/weak-topics`),
  create: (filter: PracticeFilterState) => api.request<{session: PracticeSession}>(`${base}/sessions`, 'POST', filter),
  get: (id: string) => api.request<{session: PracticeSession}>(`${base}/sessions/${encodeURIComponent(id)}`),
  answer: (id: string, body: {questionId: string; selectedAnswer: string | null; markedForReview: boolean; timeTakenSeconds: number}) => api.request<PracticeFeedback>(`${base}/sessions/${encodeURIComponent(id)}/answer`, 'POST', body),
  submit: (id: string, totalTimeSpentSeconds: number) => api.request<{results: PracticeResultSummary}>(`${base}/sessions/${encodeURIComponent(id)}/submit`, 'POST', {totalTimeSpentSeconds}),
  results: (id: string) => api.request<{results: PracticeResultSummary}>(`${base}/sessions/${encodeURIComponent(id)}/results`),
  history: () => api.request<{history: PracticeHistoryItem[]}>(`${base}/history`),
  retry: (data: {fromSessionId?: string; topic?: string; subject?: string; medium?: string}) => api.request<{session: PracticeSession}>(`${base}/retry-incorrect`, 'POST', data),
  abandon: (id: string) => api.request(`${base}/sessions/${encodeURIComponent(id)}/abandon`, 'POST'),
};
