import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '@/utils/theme';
export default function Layout() { return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:colors.gold,tabBarInactiveTintColor:colors.muted,tabBarStyle:{backgroundColor:'#fff',borderTopColor:colors.border},tabBarLabelStyle:{fontSize:11}}}>
  {([{name:'index',title:'Home',icon:'home-outline'},{name:'practice',title:'Practice',icon:'book-outline'},{name:'mocks',title:'Mocks',icon:'timer-outline'},{name:'performance',title:'Progress',icon:'stats-chart-outline'},{name:'profile',title:'Profile',icon:'person-outline'}] as const).map(tab=><Tabs.Screen key={tab.name} name={tab.name} options={{title:tab.title,tabBarIcon:({color,size})=><Ionicons name={tab.icon} color={color} size={size}/>}}/>)}
  <Tabs.Screen name="history" options={{href:null}}/>
  </Tabs>; }
