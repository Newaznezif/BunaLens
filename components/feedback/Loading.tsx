import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BunaLensTheme as theme } from '@/constants/theme';

type SpinnerProps = {
  size?: 'small' | 'large' | number;
  color?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/** Compact indeterminate activity indicator for buttons and inline actions. */
export function Spinner({ size = 'small', color = theme.colors.emerald, label, style }: SpinnerProps) {
  return (
    <View style={[styles.inline, style]} accessibilityRole="progressbar" accessibilityLabel={label || 'Loading'}>
      <ActivityIndicator size={size} color={color} />
      {label ? <Text style={styles.inlineLabel}>{label}</Text> : null}
    </View>
  );
}

type SkeletonBlockProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Theme-aware animated placeholder. Use only while the corresponding content is loading. */
export function SkeletonBlock({ width = '100%', height = 14, radius = 8, style }: SkeletonBlockProps) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessible={false}
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.colors.line, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonText({ lines = 2, lastLineWidth = '65%' }: { lines?: number; lastLineWidth?: DimensionValue }) {
  return (
    <View style={styles.skeletonText}>
      {Array.from({ length: Math.max(1, lines) }, (_, index) => (
        <SkeletonBlock key={index} width={index === lines - 1 ? lastLineWidth : '100%'} height={11} />
      ))}
    </View>
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonHeader}>
        <SkeletonBlock width={38} height={38} radius={12} />
        <SkeletonBlock width="36%" height={10} />
      </View>
      <SkeletonBlock width="52%" height={27} radius={7} style={styles.skeletonMetric} />
      <SkeletonBlock width="72%" height={10} />
    </View>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: Math.max(1, count) }, (_, index) => (
        <View key={index} style={styles.skeletonRow}>
          <SkeletonBlock width={44} height={44} radius={13} />
          <View style={styles.skeletonRowContent}>
            <SkeletonBlock width="58%" height={12} />
            <SkeletonBlock width="82%" height={9} />
          </View>
          <SkeletonBlock width={48} height={22} radius={8} />
        </View>
      ))}
    </View>
  );
}

type ProgressBarProps = {
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
  label?: string;
  showPercentage?: boolean;
};

/** Determinate progress. Only pass a percentage derived from real operation progress. */
export function ProgressBar({
  progress,
  color = theme.colors.emerald,
  trackColor = theme.colors.line,
  height = 7,
  label,
  showPercentage = false,
}: ProgressBarProps) {
  const value = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label || 'Progress'} accessibilityValue={{ min: 0, max: 100, now: value }}>
      <View style={[styles.progressTrack, { height, backgroundColor: trackColor }]}>
        <View style={[styles.progressFill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      {showPercentage ? <Text style={styles.progressText}>{Math.round(value)}%</Text> : null}
    </View>
  );
}

/** Indeterminate progress for work whose duration or percentage cannot be measured. */
export function IndeterminateProgress({
  color = theme.colors.harvest,
  trackColor = 'rgba(255,255,255,0.18)',
  height = 4,
}: {
  color?: string;
  trackColor?: string;
  height?: number;
}) {
  const translateX = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: 260, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -120, duration: 0, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [translateX]);

  return (
    <View style={[styles.progressTrack, { height, backgroundColor: trackColor, overflow: 'hidden' }]}>
      <Animated.View style={[styles.indeterminateFill, { height, backgroundColor: color, transform: [{ translateX }] }]} />
    </View>
  );
}

export function ProcessingLoader({
  title = 'Processing',
  description,
  color = '#FFFFFF',
  accent = theme.colors.harvest,
  backgroundColor = theme.colors.espresso,
}: {
  title?: string;
  description?: string;
  color?: string;
  accent?: string;
  backgroundColor?: string;
}) {
  return (
    <View style={[styles.processingCard, { backgroundColor }]}>
      <Spinner color={color} size="small" />
      <View style={styles.processingCopy}>
        <Text style={[styles.processingTitle, { color }]}>{title}</Text>
        {description ? <Text style={[styles.processingDescription, { color: color === '#FFFFFF' ? '#D6DDD5' : theme.colors.secondary }]}>{description}</Text> : null}
      </View>
      <View style={styles.processingBar}>
        <IndeterminateProgress color={accent} />
      </View>
    </View>
  );
}

/** Non-modal overlay for operations that must temporarily block a specific surface. */
export function LoadingOverlay({
  visible,
  label = 'Loading',
  backgroundColor = 'rgba(38,55,45,0.18)',
}: {
  visible: boolean;
  label?: string;
  backgroundColor?: string;
}) {
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFillObject, styles.overlay, { backgroundColor }]} pointerEvents="auto">
      <View style={styles.overlayCard}>
        <Spinner size="large" color={theme.colors.emerald} label={label} />
        <Text style={styles.overlayText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  inlineLabel: { color: theme.colors.secondary, fontSize: 12, fontWeight: '600' },
  skeletonText: { gap: 9 },
  skeletonCard: { flex: 1, minHeight: 116, padding: 16, borderRadius: 22, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, gap: 10 },
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skeletonMetric: { marginTop: 7 },
  skeletonList: { gap: 10 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line },
  skeletonRowContent: { flex: 1, gap: 8 },
  progressTrack: { width: '100%', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  progressText: { color: theme.colors.secondary, fontSize: 10, fontWeight: '700', textAlign: 'right', marginTop: 5 },
  indeterminateFill: { width: 120, borderRadius: 999 },
  processingCard: { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  processingCopy: { flex: 1, minWidth: 160 },
  processingTitle: { fontSize: 13, fontWeight: '800' },
  processingDescription: { fontSize: 10, marginTop: 4 },
  processingBar: { width: '100%', marginTop: 2 },
  overlay: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  overlayCard: { minWidth: 150, padding: 22, borderRadius: 18, backgroundColor: theme.colors.surface, alignItems: 'center', gap: 12, elevation: 8 },
  overlayText: { color: theme.colors.espresso, fontSize: 12, fontWeight: '700' },
});
