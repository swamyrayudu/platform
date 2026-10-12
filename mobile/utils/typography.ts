import type { TextStyle } from 'react-native';
import { colors } from './theme';

export const HEADING_FONT = 'RSDManropeBold';
export const HEADING_LINE_HEIGHT = 30;

// One size and color for page, card, section and dialog headings. Native font
// scaling stays enabled; Telugu glyphs use the platform's script fallback.
export const headingTypography = {
  fontSize: 20,
  lineHeight: HEADING_LINE_HEIGHT,
  fontWeight: '700',
  letterSpacing: 0,
  color: colors.ink,
  flexShrink: 1,
  minWidth: 0,
  maxWidth: '100%',
} satisfies TextStyle;
