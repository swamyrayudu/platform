import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageLayout, tabLayout } from '../utils/layout';

test('four navigation targets fit narrow and wide phones and retain the system bottom inset',()=>{
  for(const width of [280,320,360,393,412,600,768,1024])for(const scale of [1,1.3,1.8,2,3])for(const inset of [0,16,24,34,48]){
    const bar=tabLayout(width,scale,inset);
    assert.equal(bar.tabWidth*4,width);assert.ok(bar.tabWidth>=44);
    assert.ok(bar.height-inset>=58);
    assert.ok(bar.height-inset>=32+15*Math.min(scale,2)*bar.labelLines+12);
    assert.equal(bar.height-tabLayout(width,scale,0).height,inset);
  }
});
test('landscape and large text keep action bars in the scrollable page instead of occupying the viewport',()=>{
  assert.equal(pageLayout(360,740,1).inlineFooter,false);
  for(const width of [280,320,640,844,1024])assert.equal(pageLayout(width,360,1).inlineFooter,true);
  assert.equal(pageLayout(360,740,2).inlineFooter,true);
});
test('subject cards switch to one column when space or text size would make two cards too narrow',()=>{
  for(const width of [280,320,360,393,412,600,768,1024])for(const scale of [1,1.3,1.8,2,3]){
    const layout=pageLayout(width,740,scale);
    assert.ok(layout.contentWidth<=width);assert.ok(layout.contentWidth<=760);
    assert.ok(layout.padding>=12);
    if(layout.subjectColumns===2)assert.ok((layout.contentWidth-layout.padding*2-36)>=300*scale);
  }
  assert.equal(pageLayout(320,740,1).subjectColumns,1);
  assert.equal(pageLayout(768,1024,1).subjectColumns,2);
  assert.equal(pageLayout(768,1024,3).subjectColumns,1);
});
