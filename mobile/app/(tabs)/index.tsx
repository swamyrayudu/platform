import { Redirect } from 'expo-router';

// There is no Home page: the app opens on the Exam roadmap (the first tab).
// This route stays so "/" and "/(tabs)" (after sign-in, old links) still land there.
export default function Index() {
  return <Redirect href="/roadmap"/>;
}
