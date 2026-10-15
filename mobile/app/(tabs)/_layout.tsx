import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StudentHeader } from '@/components/student-header';
import { TabShellContext } from '@/components/tab-shell-context';
import { tabLayout } from '@/utils/layout';
import { colors } from '@/utils/theme';
// More holds the pages that do not fit on the bar: My Tests, Resources, Exam roadmap.
const TABS=[{name:'index',title:'Home',icon:'home-outline'},{name:'practice',title:'Practice',icon:'book-outline'},{name:'mocks',title:'Mock Tests',icon:'document-text-outline'},{name:'performance',title:'Progress',icon:'stats-chart-outline'},{name:'more',title:'More',icon:'grid-outline'}] as const;
export default function Layout() {
  const {width,fontScale}=useWindowDimensions();const insets=useSafeAreaInsets();
  const bar=tabLayout(width-insets.left-insets.right,fontScale,insets.bottom,TABS.length);
  return <TabShellContext.Provider value={true}><SafeAreaView edges={['top','left','right']} style={{flex:1,backgroundColor:colors.card}}>
  <StudentHeader/>
  <Tabs safeAreaInsets={{top:0,left:0,right:0,bottom:insets.bottom}} screenOptions={{headerShown:false,tabBarHideOnKeyboard:true,tabBarLabelPosition:'below-icon',tabBarActiveTintColor:colors.primary,tabBarInactiveTintColor:colors.muted,tabBarStyle:{height:bar.height,backgroundColor:colors.card,borderTopColor:colors.border},tabBarIconStyle:{flexGrow:0},tabBarItemStyle:{paddingVertical:6},tabBarActiveBackgroundColor:'#EBE9F750'}}>
  {TABS.map(tab=><Tabs.Screen key={tab.name} name={tab.name} options={{title:tab.title,tabBarLabel:({color,focused})=><Text maxFontSizeMultiplier={2} style={{width:'100%',paddingHorizontal:4,textAlign:'center',fontSize:11,lineHeight:15,fontWeight:focused?'700':'500',color}}>{bar.labelLines>1&&tab.title==='Mock Tests'?'Mock\nTests':tab.title}</Text>,tabBarIcon:({color})=><Ionicons name={tab.icon} color={color} size={20}/>}}/>)}
  <Tabs.Screen name="profile" options={{href:null}}/>
  <Tabs.Screen name="history" options={{href:null}}/>
  <Tabs.Screen name="roadmap" options={{href:null}}/>
  <Tabs.Screen name="my-tests" options={{href:null}}/>
  <Tabs.Screen name="resources" options={{href:null}}/>
  </Tabs></SafeAreaView></TabShellContext.Provider>;
}
