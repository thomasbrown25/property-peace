import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type AuthMarketingBackgroundProps = {
  children: React.ReactNode;
};

const GRID_LINES = Array.from({ length: 11 }, (_, index) => index + 1);

export default function AuthMarketingBackground({ children }: AuthMarketingBackgroundProps) {
  return (
    <LinearGradient
      colors={['#061e35', '#0a2d52', '#0d2040']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.background}
    >
      <View pointerEvents="none" style={styles.blueGlow} />
      <View pointerEvents="none" style={styles.greenGlow} />
      <View pointerEvents="none" style={styles.topGreenGlow} />
      <View pointerEvents="none" style={styles.grid}>
        {GRID_LINES.map((line) => (
          <React.Fragment key={line}>
            <View style={[styles.verticalGridLine, { left: `${line * 8.333}%` }]} />
            <View style={[styles.horizontalGridLine, { top: `${line * 8.333}%` }]} />
          </React.Fragment>
        ))}
      </View>
      <View pointerEvents="none" style={styles.fadeOverlay} />
      <View style={styles.content}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    overflow: 'hidden',
  },
  blueGlow: {
    position: 'absolute',
    top: -90,
    left: -110,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(33, 126, 255, 0.32)',
  },
  greenGlow: {
    position: 'absolute',
    right: -120,
    bottom: 70,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(66, 202, 119, 0.22)',
  },
  topGreenGlow: {
    position: 'absolute',
    top: -70,
    alignSelf: 'center',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(126, 227, 163, 0.10)',
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.42,
  },
  verticalGridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  horizontalGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  fadeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1, 12, 28, 0.10)',
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});
