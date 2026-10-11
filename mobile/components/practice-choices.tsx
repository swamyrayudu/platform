import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '@/utils/theme';
import { pageLayout } from '@/utils/layout';

interface Choice<T extends string> {value:T;label:string;detail?:string;icon?:ComponentProps<typeof Ionicons>['name'];color?:string}
interface Props<T extends string> {items:Choice<T>[];selected:T|T[];onSelect:(value:T)=>void;compact?:boolean;columns?:number}
export function PracticeChoices<T extends string>(props:Props<T>) {
  const {width,height,fontScale}=useWindowDimensions();const insets=useSafeAreaInsets();
  const page=pageLayout(width-insets.left-insets.right,height,fontScale);
  const columns=props.columns??(props.compact?(page.contentWidth-page.padding*2-36>=300*fontScale?3:page.contentWidth-page.padding*2-36>=180*fontScale?2:1):1);
  return <MeasuredChoices key={`${width}:${fontScale}:${columns}`} {...props} columns={columns} initialWidth={page.contentWidth-page.padding*2-36}/>;
}
function MeasuredChoices<T extends string>({items,selected,onSelect,compact,columns,initialWidth}:Props<T>&{columns:number;initialWidth:number}) {
  const [width,setWidth]=useState(initialWidth);
  const [heights,setHeights]=useState<Record<string,number>>({});
  // Measure the text at its actual width. Every choice uses the tallest text
  // in its group, allowing equal boxes without cutting off larger system text.
  const minHeight=Math.max(compact?60:80,...items.map(item=>(Object.hasOwn(heights,item.value)?heights[item.value]:0)+26));
  const itemWidth=Math.max(0,Math.floor((width-(columns-1)*8)/columns));
  return <View style={styles.grid} onLayout={event=>{if(event.nativeEvent.layout.width>0)setWidth(event.nativeEvent.layout.width);}}>{items.map(item=>{
    const checked=Array.isArray(selected)?selected.includes(item.value):selected===item.value;
    return <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={item.detail?`${item.label}, ${item.detail}`:item.label} accessibilityState={{selected:checked}} onPress={()=>onSelect(item.value)} style={({pressed})=>[styles.choice,{width:itemWidth,minHeight},compact&&styles.compact,checked&&styles.selected,pressed&&{opacity:.75}]}>
      {item.icon?<View style={[styles.icon,{backgroundColor:(item.color??colors.primary)+'15'}]}><Ionicons name={item.icon} size={20} color={item.color??colors.primary}/></View>:null}
      <View style={styles.copy} onLayout={event=>{
        const textHeight=Math.ceil(event.nativeEvent.layout.height);
        setHeights(old=>old[item.value]===textHeight?old:{...old,[item.value]:textHeight});
      }}><Text style={[styles.label,compact&&styles.center]}>{item.label}</Text>{item.detail?<Text style={[styles.detail,compact&&styles.center]}>{item.detail}</Text>:null}</View>
      {!compact?<View style={styles.check}>{checked?<Ionicons name="checkmark" size={17} color={colors.primary}/>:null}</View>:null}
    </Pressable>;
  })}</View>;
}
const styles=StyleSheet.create({
  grid:{width:'100%',flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'stretch'},
  choice:{padding:12,flexDirection:'row',alignItems:'center',gap:10,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card},compact:{paddingHorizontal:8,gap:0},selected:{borderColor:colors.primary,backgroundColor:'#F5F4FA'},
  icon:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center'},copy:{flex:1,minWidth:0,gap:3},check:{width:18,alignItems:'center'},label:{fontSize:13,lineHeight:20,fontWeight:'600',color:colors.ink},detail:{fontSize:11,lineHeight:18,color:colors.muted},center:{textAlign:'center'},
});
