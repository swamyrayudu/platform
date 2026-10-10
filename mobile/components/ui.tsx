import type { ReactNode, ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/utils/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type PageProps = { title: string; subtitle?: string; action?: ReactNode };
function PageHeading({title, subtitle, action}: PageProps) {
  return <View style={{gap:20}}>
    <View style={s.between}><View style={s.inline}><View style={s.brandMark}><Ionicons name="school-outline" size={21} color="#fff"/></View><View><Text style={s.brand}>RSD Education</Text><Text style={s.eyebrow}>AP DSC / SGT</Text></View></View>{action}</View>
    <View style={{gap:7}}><Text accessibilityRole="header" style={s.title}>{title}</Text>{subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}</View>
  </View>;
}
export function Screen({children, refreshing, onRefresh, footer, footerSafeArea=true, ...page}: PageProps & {children: ReactNode; refreshing?: boolean; onRefresh?: () => void; footer?: ReactNode; footerSafeArea?:boolean}) {
  return <SafeAreaView edges={['top','left','right']} style={s.screen}>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.content} refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary}/> : undefined}>
        <PageHeading {...page}/>{children}
      </ScrollView>
      {footer ? <SafeAreaView edges={footerSafeArea?['bottom']:[]} style={s.stickyFooter}><View style={s.footerInner}>{footer}</View></SafeAreaView> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
// Long feeds use one native virtualized list, never a list nested in ScrollView.
export function ListScreen<T>({data, renderItem, keyExtractor, header, footer, empty, onEndReached, refreshing, onRefresh, extraData, ...page}: PageProps & {
  data: T[]; renderItem: ListRenderItem<T>; keyExtractor: (item:T,index:number)=>string;
  header?: ReactNode; footer?: ReactNode; empty?: ReactNode; onEndReached?: ()=>void;
  refreshing?: boolean; onRefresh?: ()=>void; extraData?: unknown;
}) {
  return <SafeAreaView edges={['top','left','right']} style={s.screen}>
    <FlatList data={data} renderItem={renderItem} keyExtractor={keyExtractor} extraData={extraData}
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.content}
      ListHeaderComponent={<View style={{gap:20}}><PageHeading {...page}/>{header}</View>}
      ListFooterComponent={footer ? <View style={{gap:16}}>{footer}</View> : null}
      ListEmptyComponent={empty ? <View>{empty}</View> : null}
      initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={false}
      onEndReached={onEndReached} onEndReachedThreshold={0.35}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary}/> : undefined}/>
  </SafeAreaView>;
}
export function Card({children, gold = false}: {children: ReactNode; gold?: boolean}) { return <View style={[s.card, gold && {backgroundColor: colors.soft, borderColor:'#E4CFA9'}]}>{children}</View>; }
export function Heading({children}: {children: ReactNode}) { return <Text accessibilityRole="header" style={s.heading}>{children}</Text>; }
export function Body({children, color}: {children: ReactNode; color?: string}) { return <Text style={[s.body, color ? {color} : undefined]}>{children}</Text>; }
export function Badge({label, color = colors.primary}: {label:string; color?:string}) { return <View style={[s.badge,{backgroundColor:color+'12'}]}><Text style={{fontSize:12,fontWeight:'700',color}}>{label}</Text></View>; }
export function SectionHeading({title, detail, step}: {title:string; detail?:string; step?:number}) {
  return <View style={s.between}><View style={[s.inline,{flex:1}]}>{step ? <View style={s.step}><Text style={{color:'#fff',fontWeight:'700'}}>{step}</Text></View> : null}<View style={{flex:1,gap:3}}><Heading>{title}</Heading>{detail ? <Body>{detail}</Body> : null}</View></View></View>;
}
export function Button({label, onPress, disabled, busy, secondary, danger, icon}: {label: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean; danger?: boolean; icon?:IconName}) {
  const foreground = danger || !secondary ? '#fff' : colors.primary;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled: !!disabled || !!busy, busy:!!busy}} onPress={onPress} disabled={disabled || busy} style={({pressed}) => [s.button, secondary && s.secondary, danger && {backgroundColor: colors.red}, (disabled || busy) && {opacity:.45}, pressed && {opacity:.75}]}>
    {busy ? <ActivityIndicator color={foreground}/> : <View style={[s.inline,{justifyContent:'center'}]}>{icon ? <Ionicons name={icon} size={18} color={foreground}/> : null}<Text style={[s.buttonText,{color:foreground}]}>{label}</Text></View>}
  </Pressable>;
}
export function Chips<T extends string>({items, selected, onSelect}: {items: {value: T; label: string}[]; selected: T | T[]; onSelect: (value: T) => void}) {
  return <View style={s.row}>{items.map(item => { const checked = Array.isArray(selected) ? selected.includes(item.value) : selected === item.value; return <Pressable key={item.value} accessibilityRole="button" accessibilityState={{selected: checked}} onPress={() => onSelect(item.value)} style={[s.chip, checked && s.chipActive]}><Text style={{color: checked ? colors.primary : colors.muted, fontSize:14, fontWeight: checked ? '700' : '500'}}>{item.label}</Text></Pressable>; })}</View>;
}
export function ChoiceRow({title, detail, icon, color = colors.primary, selected, onPress, trailing}: {title:string; detail?:string; icon:IconName; color?:string; selected?:boolean; onPress:()=>void; trailing?:ReactNode}) {
  return <Pressable accessibilityRole="button" accessibilityState={{selected:!!selected}} onPress={onPress} style={({pressed})=>[s.choice,selected && {borderColor:colors.primary,backgroundColor:colors.primarySoft},pressed && {opacity:.75}]}>
    <View style={[s.iconBox,{backgroundColor:color+'15'}]}><Ionicons name={icon} size={23} color={color}/></View>
    <View style={{flex:1,gap:4}}><Text style={{fontSize:15,fontWeight:'700',color:colors.ink,lineHeight:22}}>{title}</Text>{detail ? <Text style={{fontSize:12,lineHeight:19,color:colors.muted}}>{detail}</Text> : null}</View>
    {trailing ?? <Ionicons name={selected ? 'checkmark-circle' : 'chevron-forward'} size={20} color={selected ? colors.primary : colors.muted}/>}
  </Pressable>;
}
export function Input({label, value, onChangeText, numeric, multiline, placeholder}: {label: string; value: string; onChangeText: (text: string) => void; numeric?: boolean; multiline?: boolean; placeholder?:string}) {
  return <View style={{gap:8}}><Text style={{fontSize:13,fontWeight:'600',color:colors.muted}}>{label}</Text><TextInput accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={colors.muted} style={[s.input, multiline && {minHeight:90, textAlignVertical:'top'}]} value={value} onChangeText={onChangeText} keyboardType={numeric ? 'number-pad' : 'default'} multiline={multiline} autoCapitalize="sentences"/></View>;
}
export function EmptyState({title, detail, icon = 'book-outline'}: {title:string;detail:string;icon?:IconName}) { return <Card><View style={s.iconBox}><Ionicons name={icon} size={26} color={colors.primary}/></View><Heading>{title}</Heading><Body>{detail}</Body></Card>; }
export function ErrorState({error, retry}: {error: unknown; retry?: () => void}) { return <Card><Body color={colors.red}>{error instanceof Error ? error.message : 'Something went wrong. Please try again.'}</Body>{retry && <Button secondary label="Try again" onPress={retry}/>}</Card>; }
export function Loading() { return <View accessibilityLabel="Loading" style={{padding:24}}><ActivityIndicator color={colors.primary} size="large"/></View>; }
export function Stats({items}: {items: {label: string; value: string | number}[]}) { return <View style={s.row}>{items.map((item,index) => <View key={item.label} style={[s.stat,index%2===1 && {backgroundColor:colors.soft}]}><Text style={s.statValue}>{item.value}</Text><Text style={{fontSize:12,lineHeight:18,color:colors.muted}}>{item.label}</Text></View>)}</View>; }
export function Bar({value, color = colors.primary}: {value: number; color?:string}) { return <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:Math.round(Math.max(0,Math.min(100,value)))}} style={{height:6, backgroundColor:colors.border, borderRadius:4, overflow:'hidden'}}><View style={{height:6, width:`${Math.max(0,Math.min(100,value))}%`,backgroundColor:color}}/></View>; }
export const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background},content:{padding:20,paddingBottom:32,gap:18,maxWidth:760,width:'100%',alignSelf:'center'},
  brandMark:{width:40,height:40,borderRadius:13,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center'},brand:{fontSize:16,fontWeight:'800',color:colors.ink},eyebrow:{fontSize:10,fontWeight:'600',letterSpacing:1.5,color:colors.muted,marginTop:3},
  title:{fontSize:27,lineHeight:35,fontWeight:'800',letterSpacing:-.5,color:colors.ink},subtitle:{fontSize:14,lineHeight:22,color:colors.muted},
  card:{padding:18,borderRadius:24,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,gap:14},heading:{fontSize:17,lineHeight:25,fontWeight:'700',color:colors.ink},body:{fontSize:14,lineHeight:22,color:colors.muted},
  button:{minHeight:50,padding:14,borderRadius:16,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center'},secondary:{backgroundColor:colors.card,borderWidth:1,borderColor:colors.border},buttonText:{fontSize:14,lineHeight:20,fontWeight:'700',textAlign:'center',flexShrink:1},
  row:{flexDirection:'row',flexWrap:'wrap',gap:8},inline:{flexDirection:'row',alignItems:'center',gap:10},between:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  chip:{minHeight:44,paddingHorizontal:14,paddingVertical:12,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card},chipActive:{backgroundColor:colors.primarySoft,borderColor:colors.primary},
  input:{borderWidth:1,borderColor:colors.border,borderRadius:14,minHeight:50,padding:13,fontSize:16,color:colors.ink,backgroundColor:colors.card},
  stat:{flexGrow:1,flexBasis:'43%',backgroundColor:colors.primarySoft,borderRadius:20,padding:16,gap:5},statValue:{fontSize:25,fontWeight:'800',color:colors.ink},
  badge:{alignSelf:'flex-start',borderRadius:30,paddingHorizontal:10,paddingVertical:6},step:{width:27,height:27,borderRadius:14,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center'},
  choice:{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:18,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,minHeight:76},iconBox:{width:44,height:44,borderRadius:14,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center'},
  stickyFooter:{borderTopWidth:1,borderTopColor:colors.border,backgroundColor:colors.card},footerInner:{padding:16,gap:8,maxWidth:760,width:'100%',alignSelf:'center'},
});
