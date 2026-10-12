import { createContext, useContext, type ReactNode } from 'react';
import { Text, type TextProps } from 'react-native';
import { useFonts } from 'expo-font';
import { HEADING_FONT, headingTypography } from '@/utils/typography';

const headingFonts = { [HEADING_FONT]: require('../assets/fonts/Manrope-Bold.ttf') };
const HeadingFontContext = createContext(false);

export function HeadingFontProvider({ children }: { children: ReactNode }) {
  const [loaded] = useFonts(headingFonts);
  // Keep navigation/session restoration running even if font loading fails.
  return <HeadingFontContext.Provider value={loaded}>{children}</HeadingFontContext.Provider>;
}

export function Heading({ style, ...props }: TextProps) {
  const loaded = useContext(HeadingFontContext);
  return <Text {...props} accessibilityRole="header"
    style={[style, headingTypography, { fontFamily: loaded ? HEADING_FONT : undefined }]} />;
}
