import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen, ChoiceRow, Heading } from '@/components/ui';
import { colors } from '@/utils/theme';

// The pages that do not fit on the bottom bar, as on the website's More menu.
const PAGES = [
  {href: '/roadmap', title: 'Exam roadmap', detail: '90-day plan, exam pattern and syllabus', icon: 'map-outline', color: '#6F66BA'},
  {href: '/my-tests', title: 'My Tests', detail: 'Make a test with AI and take it', icon: 'create-outline', color: '#4F8B81'},
  {href: '/resources', title: 'Resources', detail: 'Books, study material and bit banks', icon: 'library-outline', color: '#B3835A'},
] as const;

export default function More() {
  return <Screen title="More" pageHeader={<View style={styles.intro}><Heading>More</Heading><Text style={styles.subtitle}>Plan your preparation and study material.</Text></View>}>
    <View style={styles.list}>
      {PAGES.map(page => <ChoiceRow key={page.href} title={page.title} detail={page.detail} icon={page.icon} color={page.color} onPress={() => router.push(page.href)}/>)}
    </View>
  </Screen>;
}
const styles = StyleSheet.create({
  intro: {gap: 5}, subtitle: {fontSize: 12, lineHeight: 20, color: colors.muted},
  list: {gap: 10},
});
