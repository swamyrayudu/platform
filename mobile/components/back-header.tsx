import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Heading } from './heading';
import { colors } from '@/utils/theme';

/** Page heading with a back button, for screens opened from the More tab. */
export function BackHeader({title, subtitle, fallback, action}: {title: string; subtitle?: string; fallback: Href; action?: ReactNode}) {
  const back = () => { if (router.canGoBack()) router.back(); else router.replace(fallback); };
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
