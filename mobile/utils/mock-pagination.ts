import type { MockTestListResponse } from '../types/mock-tests';
import { infiniteQueryOptions } from '@tanstack/react-query';

export type MockLibraryFilters = {medium:string;category:string;search:string};
export const MOCK_PAGE_SIZE = 5;
export function mockLibraryOptions(filters:MockLibraryFilters, loadPage:(params:MockLibraryFilters & {page:number;pageSize:number})=>Promise<MockTestListResponse>) {
  return infiniteQueryOptions({
    // Keep the previous 20-module cache separate from this five-module feed.
    queryKey:['mocks',filters.medium,filters.category,filters.search,MOCK_PAGE_SIZE],
    initialPageParam:1,
    queryFn:({pageParam})=>loadPage({...filters,page:pageParam,pageSize:MOCK_PAGE_SIZE}),
    getNextPageParam:nextMockPage,
  });
}

export function nextMockPage(last: MockTestListResponse) {
  return last.tests.length > 0 && last.page < last.total_pages ? last.page + 1 : undefined;
}

export function mergeMockPages(pages: MockTestListResponse[]) {
  // A paper moved by a server-side update can occur at a page boundary twice.
  // Keep one row per paper, with the latest progress/access state.
  return [...new Map(pages.flatMap(page => page.tests.map(test => [test.id,test] as const))).values()];
}
