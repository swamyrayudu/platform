import { useContext, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Heading } from './heading';
import { TabShellContext } from './tab-shell-context';
import { colors } from '@/utils/theme';

/**
 * Page heading with a back button. Inside the tab bar (pages opened from More)
 * it goes to its parent page, since tab history can lead back to Home instead;
 * on full-screen pages it goes back.
 */
export function BackHeader({title, subtitle, fallback, action, onBack}: {title: string; subtitle?: string; fallback: Href; action?: ReactNode; onBack?: () => void}) {
  const inTabs = useContext(TabShellContext);
  const back = () => { if (onBack) onBack(); else if (!inTabs && router.canGoBack()) router.back(); else router.navigate(fallback); };
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={6} onPress={back} style={({pressed}) => [styles.back, pressed && {opacity: .6}]}>
      <Ionicons name="arrow-back" size={22} color={colors.primary}/>
    </Pressable>
    <View style={styles.copy}>
      <Heading>{title}</Heading>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
    {action}
  </View>;
}
const styles = StyleSheet.create({
  header: {flexDirection: 'row', alignItems: 'center', gap: 10},
  back: {width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border},
  copy: {flex: 1, minWidth: 0, gap: 2},
  subtitle: {fontSize: 12, lineHeight: 18, color: colors.muted},
});
