// Shared geometry for phones, tablets, landscape and larger system text.
export function pageLayout(width:number,height:number,fontScale=1) {
  const scale=Math.max(1,fontScale);
  const padding=width<360?12:width<600?18:24;
  const contentWidth=Math.min(760,width);
  const innerWidth=Math.max(0,contentWidth-padding*2-36);
  return {padding,contentWidth,inlineFooter:height/scale<500,subjectColumns:innerWidth>=300*scale?2:1};
}
export function tabLayout(width:number,fontScale:number,bottomInset:number) {
  const scale=Math.min(2,Math.max(1,fontScale));
  const tabWidth=Math.max(1,width/4);
  const labelLines=Math.max(1,Math.ceil(8*6.5*scale/Math.max(1,tabWidth-12)));
  const contentHeight=Math.max(58,32+15*scale*labelLines+12);
  return {tabWidth,labelLines,height:contentHeight+Math.max(0,bottomInset)};
}
