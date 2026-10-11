import type { PracticeFilterState } from '../types/practice';
export type PracticeFilterRequest=Pick<PracticeFilterState,'medium'|'subject'|'class_levels'|'topics'|'subtopics'|'difficulty'>;
export function practiceFilterRequest(filter:PracticeFilterState):PracticeFilterRequest {
  return {medium:filter.medium,subject:filter.subject,class_levels:[...filter.class_levels].sort(),topics:[...filter.topics].sort(),subtopics:[...filter.subtopics].sort(),difficulty:[...filter.difficulty].sort()};
}
// Only selections that change the topic catalog reset its visible content.
export function samePracticeCatalog(a:PracticeFilterRequest,b:PracticeFilterRequest) {
  return a.medium===b.medium&&a.subject===b.subject&&JSON.stringify(a.class_levels)===JSON.stringify(b.class_levels);
}
