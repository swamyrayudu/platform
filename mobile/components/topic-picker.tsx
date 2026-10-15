import { useMemo, useState } from 'react';
import { Badge, Body, Button, Input } from './ui';
import { PracticeChoices } from './practice-choices';
import { useProgressiveList } from '@/hooks/use-progressive-list';
import type { DynamicFilterOptions } from '@/types/practice';
import { isBrokenTopicName } from '@/utils/roadmap-practice';

export function TopicPicker({topics, selected, onToggle, scope}: {topics:DynamicFilterOptions['available_topics'];selected:string[];onToggle:(topic:string)=>void;scope:string}) {
  const [search,setSearch]=useState('');
  const [showSelected,setShowSelected]=useState(false);
  // Names stored with broken characters are not offered.
  const matching=useMemo(()=>topics.filter(topic=>!isBrokenTopicName(topic.name)&&topic.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),[topics,search]);
  const feed=useProgressiveList(matching,`${scope}:${search}`,12);
  const selectedFeed=useProgressiveList(selected,`${scope}:selected:${showSelected}`,12);
  return <>
    <Input label="Search topics" placeholder="Topic name…" value={search} onChangeText={setSearch}/>
    {selected.length ? <><Badge label={`${selected.length} topics selected`}/><Button secondary label={showSelected?'Hide selected topics':'View selected topics'} onPress={()=>setShowSelected(value=>!value)}/>{showSelected?<><PracticeChoices items={selectedFeed.items.map(value=>({value,label:value}))} selected={selected} onSelect={onToggle}/>{selectedFeed.hasMore?<Button secondary label="Show more selected topics" onPress={selectedFeed.loadMore}/>:null}</>:null}</> : null}
    <PracticeChoices items={feed.items.map(topic=>({value:topic.name,label:topic.name,detail:`${topic.count} questions`}))} selected={selected} onSelect={onToggle}/>
    {!matching.length ? <Body>No topics match your search.</Body> : null}
    {feed.hasMore ? <Button secondary label={`Show more topics (${Math.min(feed.items.length,matching.length)} of ${matching.length})`} onPress={feed.loadMore}/> : null}
    <Body>No selection includes all topics.</Body>
  </>;
}
