import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { colors } from '@/utils/theme';

const logo = require('../assets/icon.png');

// Navigation and session restoration mount underneath this short introduction.
// Keeping it outside Navigation prevents a replay after sign-in or an auth reload.
export function AppOpening() {
  const [visible, setVisible] = useState(true);
  const [imageReady, setImageReady] = useState(false);
  const [fade] = useState(() => new Animated.Value(1));
  const [entrance] = useState(() => new Animated.Value(0));
  const { width, height } = useWindowDimensions();
  const logoSize = Math.max(64, Math.min(156, width * 0.36, height * 0.3));

  useEffect(() => {
    // Image loading and accessibility checks must never trap the user.
    const timeout = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!imageReady || !visible) return;
    let disposed = false;
    let completed = false;
    let animation: Animated.CompositeAnimation | undefined;
    const finish = () => { completed = true; if (!disposed) setVisible(false); };
    const animate = (reducedMotion: boolean) => {
      if (disposed || completed) return;
      if (reducedMotion) { finish(); return; }
      animation = Animated.sequence([
        Animated.timing(entrance, {
          toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.delay(180),
        Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]);
      animation.start(({ finished }) => { if (finished) finish(); });
    };
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      if (enabled) { animation?.stop(); finish(); }
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(animate, () => animate(true));
    return () => {
      disposed = true;
      listener.remove();
      animation?.stop();
    };
  }, [entrance, fade, imageReady, visible]);

  if (!visible) return null;
  return <Animated.View accessibilityViewIsModal accessibilityLabel="Opening RSD Education" style={[styles.overlay, { opacity: fade }]}>
    <Animated.View style={[styles.brand, {
      opacity: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
      transform: [
        { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
        { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
      ],
    }]}>
      <Image source={logo} accessible={false} resizeMode="contain" onLoadEnd={() => setImageReady(true)} style={{ width: logoSize, height: logoSize }}/>
      <Text accessibilityRole="header" style={styles.name}>RSD Education</Text>
      <Text style={styles.caption}>Learn. Practice. Grow.</Text>
    </Animated.View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, backgroundColor: '#FFFEFB', alignItems: 'center', justifyContent: 'center', padding: 24 },
  brand: { alignItems: 'center', gap: 10, width: '100%', maxWidth: 400 },
  name: { color: colors.primary, fontSize: 24, lineHeight: 32, fontWeight: '700', textAlign: 'center' },
  caption: { color: colors.gold, fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
