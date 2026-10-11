import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageLayout, tabLayout, practiceChoiceLayout, examControlLayout, resultCountLayout } from '../utils/layout';

test('four navigation targets fit narrow and wide phones and retain the system bottom inset',()=>{
  for(const width of [280,320,360,393,412,600,768,1024])for(const scale of [1,1.3,1.8,2,3])for(const inset of [0,16,24,34,48]){
    const bar=tabLayout(width,scale,inset);
    assert.equal(bar.tabWidth*4,width);assert.ok(bar.tabWidth>=44);
    assert.ok(bar.height-inset>=58);
    assert.ok(bar.height-inset>=32+15*Math.min(scale,2)*bar.labelLines+12);
    assert.equal(bar.height-tabLayout(width,scale,0).height,inset);
  }
});
test('result count boxes use equal widths and stack all three together for larger text',()=>{
  for(const width of [160,200,222,262,300,360,480,680])for(const scale of [1,1.3,1.8,2,3]){
    const grid=resultCountLayout(width,scale);
    assert.ok(grid.columns===1||grid.columns===3);
    assert.ok(grid.itemWidth*grid.columns+(grid.columns-1)*8<=width);
    if(grid.columns===3)assert.ok(grid.itemWidth>=52*scale+16-1);
  }
  assert.equal(resultCountLayout(222,1).columns,3);
  assert.equal(resultCountLayout(262,1).columns,3);
  assert.equal(resultCountLayout(262,2).columns,1);
});
test('exam controls stack instead of squeezing scaled labels into narrow rows',()=>{
  for(const width of [280,320,360,393,412,600,768,1024])for(const scale of [1,1.3,1.8,2,3]) {
    const controls=examControlLayout(width,scale);
    const page=pageLayout(width,800,scale);
    const contentWidth=page.contentWidth-page.padding*2;
    const questionWidth=contentWidth-controls.cardPadding*2-2;
    assert.ok(questionWidth>0);
    if(!controls.stackedHeader)assert.ok(width>=16+44+4+60*scale+8+88+8+70*scale);
    if(!controls.stackedActions)assert.ok(questionWidth>=2*(100*scale+24)+8);
    if(!controls.stackedNavigation)assert.ok(contentWidth>=2*(100*scale+24)+10);
  }
  assert.equal(examControlLayout(320,1).stackedHeader,false);
  assert.equal(examControlLayout(280,1).stackedHeader,true);
  assert.equal(examControlLayout(360,1).stackedActions,false);
  assert.equal(examControlLayout(360,2).stackedActions,true);
  assert.equal(examControlLayout(360,2).stackedNavigation,true);
  assert.equal(examControlLayout(768,2).stackedActions,false);
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
    if(layout.subjectColumns===2)assert.ok((layout.contentWidth-layout.padding*2-36)>=480*scale);
  }
  assert.equal(pageLayout(320,740,1).subjectColumns,1);
  for(const width of [360,393,412,430])assert.equal(pageLayout(width,900,1).subjectColumns,1);
  assert.equal(pageLayout(768,1024,1).subjectColumns,2);
  assert.equal(pageLayout(768,1024,3).subjectColumns,1);
});
test('practice choices fit their measured container and reduce requested columns for larger text',()=>{
  for(const width of [160,200,240,280,320,360,480,600,700])for(const scale of [1,1.3,1.8,2,3])for(const compact of [true,false])for(const requested of [1,2,3]) {
    const grid=practiceChoiceLayout(width,scale,compact,requested);
    assert.ok(grid.columns>=1&&grid.columns<=requested);
    assert.ok(grid.itemWidth>0);
    assert.ok(grid.itemWidth*grid.columns+(grid.columns-1)*8<=width,'Tiles and gaps must not extend outside their container.');
    if(grid.columns>1)assert.ok(grid.itemWidth>=(compact?90:220)*scale-1,'Multiple columns must leave room for scaled labels.');
  }
  assert.equal(practiceChoiceLayout(300,1,true,2).columns,2);
  assert.equal(practiceChoiceLayout(300,2,true,2).columns,1);
  assert.equal(practiceChoiceLayout(230,1.3,true,2).columns,1);
  assert.equal(practiceChoiceLayout(680,1,false,2).columns,2);
  assert.equal(practiceChoiceLayout(680,2,false,2).columns,1);
});
