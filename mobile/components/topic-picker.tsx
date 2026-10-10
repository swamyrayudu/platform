import { useMemo, useState } from 'react';
import { Badge, Body, Button, Chips, Input } from './ui';
import { useProgressiveList } from '@/hooks/use-progressive-list';
import type { DynamicFilterOptions } from '@/types/practice';

export function TopicPicker({topics, selected, onToggle, scope}: {topics:DynamicFilterOptions['available_topics'];selected:string[];onToggle:(topic:string)=>void;scope:string}) {
  const [search,setSearch]=useState('');
  const matching=useMemo(()=>topics.filter(topic=>topic.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),[topics,search]);
  const feed=useProgressiveList(matching,`${scope}:${search}`,12);
  return <>
    <Input label="Find a topic or concept" placeholder="Search topics…" value={search} onChangeText={setSearch}/>
    {selected.length ? <><Badge label={`${selected.length} topics selected`}/><Chips items={selected.map(value=>({value,label:value}))} selected={selected} onSelect={onToggle}/></> : null}
    <Chips items={feed.items.map(topic=>({value:topic.name,label:`${topic.name} (${topic.count})`}))} selected={selected} onSelect={onToggle}/>
    {!matching.length ? <Body>No topics match your search.</Body> : null}
    {feed.hasMore ? <Button secondary label={`Show more topics (${Math.min(feed.items.length,matching.length)} of ${matching.length})`} onPress={feed.loadMore}/> : null}
    <Body>Leave topics unselected to practise the full syllabus.</Body>
  </>;
}
