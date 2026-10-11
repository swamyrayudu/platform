import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '@/utils/theme';
import { pageLayout, practiceChoiceLayout } from '@/utils/layout';

interface Choice<T extends string> {value:T;label:string;detail?:string;icon?:ComponentProps<typeof Ionicons>['name'];color?:string;accent?:'gold'}
interface Props<T extends string> {items:Choice<T>[];selected:T|T[];onSelect:(value:T)=>void;compact?:boolean;columns?:number}
export function PracticeChoices<T extends string>(props:Props<T>) {
  const {width,height,fontScale}=useWindowDimensions();const insets=useSafeAreaInsets();
  const page=pageLayout(width-insets.left-insets.right,height,fontScale);
  return <MeasuredChoices key={`${width}:${fontScale}:${props.columns}:${props.compact}`} {...props} fontScale={fontScale} initialWidth={Math.max(0,page.contentWidth-page.padding*2-36)}/>;
}
function MeasuredChoices<T extends string>({items,selected,onSelect,compact,columns:requestedColumns,initialWidth,fontScale}:Props<T>&{initialWidth:number;fontScale:number}) {
  const [width,setWidth]=useState(initialWidth);
  // Only a row with longer text grows; it must not enlarge the whole list.
  const minHeight=compact?48:60;
  const {itemWidth}=practiceChoiceLayout(width,fontScale,!!compact,requestedColumns);
  return <View style={styles.grid} onLayout={event=>{if(event.nativeEvent.layout.width>0)setWidth(event.nativeEvent.layout.width);}}>{items.map(item=>{
    const checked=Array.isArray(selected)?selected.includes(item.value):selected===item.value;
    return <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={item.detail?`${item.label}, ${item.detail}`:item.label} accessibilityState={{selected:checked}} onPress={()=>onSelect(item.value)} style={({pressed})=>[styles.choice,{width:itemWidth,minHeight},compact&&styles.compact,item.accent==='gold'&&styles.gold,checked&&styles.selected,pressed&&{opacity:.75}]}>
      {item.icon?<View style={[styles.icon,{backgroundColor:(item.color??colors.primary)+'15'}]}><Ionicons name={item.icon} size={18} color={item.color??colors.primary}/></View>:null}
      <View style={styles.copy}><Text style={[styles.label,compact&&styles.center,item.accent==='gold'&&styles.goldLabel]}>{item.label}</Text>{item.detail?<Text style={[styles.detail,compact&&styles.center]}>{item.detail}</Text>:null}</View>
      {!compact?<View style={styles.check}>{checked?<Ionicons name="checkmark" size={17} color={colors.primary}/>:null}</View>:null}
    </Pressable>;
  })}</View>;
}
const styles=StyleSheet.create({
  gold:{backgroundColor:'#FCF4E6',borderColor:'#E4CFA9'},goldLabel:{color:'#805717'},
  grid:{width:'100%',flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'stretch'},
  choice:{paddingHorizontal:10,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:8,borderRadius:12,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card},compact:{paddingHorizontal:8,gap:0},selected:{borderColor:colors.primary,backgroundColor:'#F5F4FA'},
  icon:{width:32,height:32,borderRadius:10,alignItems:'center',justifyContent:'center'},copy:{flex:1,minWidth:0,gap:2},check:{width:18,alignItems:'center'},label:{fontSize:13,lineHeight:20,fontWeight:'600',color:colors.ink},detail:{fontSize:11,lineHeight:17,color:colors.muted},center:{textAlign:'center'},
});
