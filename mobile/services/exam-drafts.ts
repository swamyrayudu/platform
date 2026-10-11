import { createExamDraftStore } from '@/store/exam-drafts';
import { vault } from './vault';

export const examDrafts=createExamDraftStore(vault);
