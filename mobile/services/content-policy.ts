import Constants from 'expo-constants';

// Google Play build only: hide Resources (books, study material, bit banks,
// previous papers) and previous-paper mock tests, until we hold the rights to
// publish that content on Google Play. The roadmap's study-note PDFs are our
// own work and show in every build, Google Play included (for reviewers too:
// never show reviewers something different from students).
// The website APK (RSD_DISTRIBUTION=direct) and the website keep everything.
// To bring them back in the Play app, set this to true for 'store' as well.
export const showsStudyFiles = Constants.expoConfig?.extra?.distribution === 'direct';

/** Mock category the server leaves out of the list in the Play build. */
export const hiddenMockCategory = showsStudyFiles ? undefined : 'previous_paper';
