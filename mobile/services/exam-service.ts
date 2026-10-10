import { api, query } from './api-client';
import type { MockTest, MockTestListResponse, StartAttemptResponse, ClientSafeMockQuestion, MockTestResultSummary, MockTestLeaderboardEntry, SelectedOption } from '@/types/mock-tests';
const base = '/api/dsc-sgt/mock-tests';
export interface Attempt { id: string; mock_test_id: string; status: string; duration_seconds: number; time_spent_seconds: number; existing_answers: Record<string, {selected_option: SelectedOption; marked_for_review: boolean}> }
export const examService = {
  list: (params: {medium: string; search?: string; category?: string; page: number}) => api.request<MockTestListResponse>(`${base}?${query({...params, pageSize: 20})}`),
  metadata: (id: string) => api.request<{test: MockTest}>(`${base}/${encodeURIComponent(id)}`),
  start: (id: string) => api.request<StartAttemptResponse>(`${base}/${encodeURIComponent(id)}/start`, 'POST'),
  get: (id: string) => api.request<{attempt: Attempt}>(`${base}/attempts/${encodeURIComponent(id)}`),
  async questions(id: string) {
    const questions: ClientSafeMockQuestion[] = []; let start: number | null = 1;
    while (start !== null) {
      const data: {questions: ClientSafeMockQuestion[]; next_start: number | null} = await api.request(`${base}/${encodeURIComponent(id)}/questions?start=${start}&limit=50`);
      questions.push(...data.questions);
      if (data.next_start !== null && data.next_start <= start) throw new Error('Invalid question pagination.');
      start = data.next_start;
    }
    return questions;
  },
  answer: (id: string, body: {questionId: string; questionNumber: number; selectedOption: SelectedOption; markedForReview: boolean; timeTakenSeconds: number}) => api.request(`${base}/attempts/${encodeURIComponent(id)}/answer`, 'POST', body),
  pause: (id: string, totalTimeSpentSeconds: number) => api.request(`${base}/attempts/${encodeURIComponent(id)}/pause`, 'POST', {totalTimeSpentSeconds}),
  submit: (id: string, totalTimeSpentSeconds: number) => api.request<{result: MockTestResultSummary}>(`${base}/attempts/${encodeURIComponent(id)}/submit`, 'POST', {totalTimeSpentSeconds}),
  result: (id: string) => api.request<{result: MockTestResultSummary}>(`${base}/attempts/${encodeURIComponent(id)}/result`),
  leaderboard: (id: string) => api.request<{leaderboard: MockTestLeaderboardEntry[]}>(`${base}/${encodeURIComponent(id)}/leaderboard?limit=50`),
  next: (id: string) => api.request<{next_module: {id: string} | null}>(`${base}/${encodeURIComponent(id)}/next`),
  abandon: (id: string) => api.request(`${base}/attempts/${encodeURIComponent(id)}/abandon`, 'POST'),
};
