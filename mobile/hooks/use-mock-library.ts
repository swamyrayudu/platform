import { useInfiniteQuery } from '@tanstack/react-query';
import { examService } from '@/services/exam-service';
import { mockLibraryOptions, type MockLibraryFilters } from '@/utils/mock-pagination';

export function useMockLibrary(filters: MockLibraryFilters) {
  return useInfiniteQuery(mockLibraryOptions(filters,examService.list));
}
