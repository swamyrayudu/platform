// Exam roadmap, My Tests and Resources: the website's APIs, used as-is.
import { api, query } from './api-client';
import type { MyTestAttempt, MyTestDetail, MyTestListItem, MyTestQuestion, MyTestSummary, PastedCheck, PlanMedium, Resource, Roadmap } from '@/types/learning';

const base = '/api/dsc-sgt';

export const roadmapService = {
  get: (medium: PlanMedium) => api.request<Roadmap & {success: true}>(`${base}/roadmap?${query({medium})}`),
};

export interface NewTest { title: string; medium: PlanMedium; subject: string; topics: string[]; duration_minutes: number; questions: MyTestQuestion[] }
export interface PromptRequest { subject: string; medium: PlanMedium; topics: string[]; question_count: number; difficulty: 'mixed'|'easy'|'medium'|'hard' }

export const myTestsService = {
  list: () => api.request<{tests: MyTestListItem[]; limit: number}>(`${base}/my-tests`),
  get: (id: string) => api.request<{test: MyTestDetail; attempts: MyTestAttempt[]}>(`${base}/my-tests/${encodeURIComponent(id)}`),
  prompt: (request: PromptRequest) => api.request<{prompt: string}>(`${base}/my-tests/prompt`, 'POST', {...request, output: 'text'}),
  check: (csv: string) => api.request<PastedCheck>(`${base}/my-tests/check`, 'POST', {csv}),
  create: (test: NewTest) => api.request<{test: MyTestSummary}>(`${base}/my-tests`, 'POST', test),
  remove: (id: string) => api.request<{success: true}>(`${base}/my-tests/${encodeURIComponent(id)}`, 'DELETE'),
  submit: (id: string, answers: string, seconds: number) =>
    api.request<{attempt: MyTestAttempt}>(`${base}/my-tests/${encodeURIComponent(id)}/attempts`, 'POST', {answers, time_spent_seconds: seconds}),
  topics: (medium: PlanMedium, subject: string) =>
    api.request<{data: {available_topics: {name: string; count: number}[]}}>(`${base}/practice/filters?${query({medium, subject, fields: 'topics'})}`),
};

export const resourcesService = {
  list: () => api.request<{resources: Resource[]}>(`${base}/resources`),
  link: (id: string, download = false) => api.request<{url: string}>(`${base}/resources/${encodeURIComponent(id)}/link`, 'POST', {download}),
};
