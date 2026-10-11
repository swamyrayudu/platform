import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { practiceService } from '@/services/question-service';
import { practiceFilterRequest, samePracticeCatalog, type PracticeFilterRequest } from '@/utils/practice-filter-request';
import type { PracticeFilterState } from '@/types/practice';

export function usePracticeFilters(filter:PracticeFilterState,enabled=true) {
  const key=JSON.stringify(practiceFilterRequest(filter));
  const [requestKey,setRequestKey]=useState(key);
  useEffect(()=>{
    if(requestKey===key)return;
    const timer=setTimeout(()=>setRequestKey(key),180);
    return()=>clearTimeout(timer);
  },[key,requestKey]);
  const request=useMemo(()=>JSON.parse(requestKey) as PracticeFilterRequest,[requestKey]);
  const current=practiceFilterRequest(filter);
  const query=useQuery({
    queryKey:['practice-filters',request],queryFn:()=>practiceService.filters(request),enabled,staleTime:120000,
    placeholderData:(previous,previousQuery)=>{
      const previousRequest=previousQuery?.queryKey[1] as PracticeFilterRequest|undefined;
      return previousRequest&&samePracticeCatalog(previousRequest,request)?previous:undefined;
    },
  });
  const catalogMatches=samePracticeCatalog(current,request);
  const settling=key!==requestKey;
  return {...query,data:catalogMatches?query.data:undefined,error:settling?null:query.error,checking:settling||query.isFetching||query.isPending,
    ready:!settling&&!query.isFetching&&!query.isPlaceholderData&&!query.isError&&!!query.data};
}
