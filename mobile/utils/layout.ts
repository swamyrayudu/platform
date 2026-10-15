// Shared geometry for phones, tablets, landscape and larger system text.
export function pageLayout(width:number,height:number,fontScale=1) {
  const scale=Math.max(1,fontScale);
  const padding=width<360?12:width<600?18:24;
  const contentWidth=Math.min(760,width);
  const innerWidth=Math.max(0,contentWidth-padding*2-36);
  return {padding,contentWidth,inlineFooter:height/scale<500,subjectColumns:innerWidth>=480*scale?2:1};
}
export function tabLayout(width:number,fontScale:number,bottomInset:number,tabs=4) {
  const scale=Math.min(2,Math.max(1,fontScale));
  const tabWidth=Math.max(1,width/tabs);
  const labelLines=Math.max(1,Math.ceil(8*6.5*scale/Math.max(1,tabWidth-12)));
  const contentHeight=Math.max(58,32+15*scale*labelLines+12);
  return {tabWidth,labelLines,height:contentHeight+Math.max(0,bottomInset)};
}
// Requested columns are a maximum: large text and narrow containers need fewer.
export function practiceChoiceLayout(width:number,fontScale:number,compact:boolean,maxColumns=compact?3:1) {
  const available=Math.max(0,width);
  const minimum=(compact?90:220)*Math.max(1,fontScale);
  const columns=Math.min(Math.max(1,Math.floor(maxColumns)),Math.max(1,Math.floor((available+8)/(minimum+8))));
  return {columns,itemWidth:Math.max(0,Math.floor((available-(columns-1)*8)/columns))};
}
// Header and action rows must also account for enlarged system text.
export function examControlLayout(width:number,fontScale=1) {
  const scale=Math.max(1,fontScale);
  const padding=pageLayout(width,800,scale).padding;
  const cardPadding=width<360?14:16;
  const contentWidth=Math.min(760,width)-padding*2;
  const questionWidth=Math.max(0,contentWidth-cardPadding*2-2);
  return {
    cardPadding,
    stackedHeader:width<16+44+4+60*scale+8+88+8+70*scale,
    stackedActions:questionWidth<2*(100*scale+24)+8,
    stackedNavigation:contentWidth<2*(100*scale+24)+10,
  };
}
// Three outcome counts share one row, or become three full-width rows. Avoid
// leaving a lone third tile in a squeezed two-column layout.
export function resultCountLayout(width:number,fontScale=1) {
  const available=Math.max(0,width);
  const minimum=52*Math.max(1,fontScale)+16;
  const columns=available>=minimum*3+16?3:1;
  return {columns,itemWidth:Math.max(0,Math.floor((available-(columns-1)*8)/columns))};
}
