import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  resolveReducedMotionPreference,
  resolveStartupVisualState,
} from '../features/startup/startupPresentation';

const logo = require('../../assets/property-peace-logo.png');

interface AnimatedLoadingScreenProps {
  playIntro?: boolean;
  onIntroComplete?: () => void;
}

type BirdPath = {
  x: number[];
  y: number[];
};

type BirdSilhouetteProps = {
  path: BirdPath;
  progress: Animated.Value;
  size: number;
  tone: string;
  viewportHeight: number;
  viewportWidth: number;
};

const FLOCK = [
  { delay: 160, duration: 1420, size: 25, tone: 'rgba(4, 18, 32, 0.86)' },
  { delay: 300, duration: 1520, size: 18, tone: 'rgba(8, 30, 49, 0.68)' },
  { delay: 430, duration: 1380, size: 21, tone: 'rgba(9, 26, 43, 0.76)' },
  { delay: 590, duration: 1320, size: 14, tone: 'rgba(25, 54, 70, 0.56)' },
];

function BirdSilhouette({
  path,
  progress,
  size,
  tone,
  viewportHeight,
  viewportWidth,
}: BirdSilhouetteProps) {
  const wingLeft = progress.interpolate({
    inputRange: [0, 0.18, 0.36, 0.54, 0.72, 0.9, 1],
    outputRange: ['18deg', '-7deg', '20deg', '-5deg', '17deg', '-4deg', '12deg'],
  });
  const wingRight = progress.interpolate({
    inputRange: [0, 0.18, 0.36, 0.54, 0.72, 0.9, 1],
    outputRange: ['-18deg', '7deg', '-20deg', '5deg', '-17deg', '4deg', '-12deg'],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bird,
        {
          height: size,
          left: viewportWidth / 2 - size / 2,
          opacity: progress.interpolate({
            inputRange: [0, 0.08, 0.88, 1],
            outputRange: [0, 0.92, 0.92, 0],
          }),
          top: viewportHeight / 2 - size / 2,
          width: size * 1.9,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 0.35, 0.68, 1],
                outputRange: path.x,
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 0.35, 0.68, 1],
                outputRange: path.y,
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 0.58, 1],
                outputRange: [0.78, 1, 0.88],
              }),
            },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.wing,
          styles.wingLeft,
          {
            backgroundColor: tone,
            height: Math.max(2, size * 0.1),
            width: size,
            transform: [{ rotate: wingLeft }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.wing,
          styles.wingRight,
          {
            backgroundColor: tone,
            height: Math.max(2, size * 0.1),
            width: size,
            transform: [{ rotate: wingRight }],
          },
        ]}
      />
    </Animated.View>
  );
}

export default function AnimatedLoadingScreen({
  playIntro = false,
  onIntroComplete,
}: AnimatedLoadingScreenProps) {
  const { height, width } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(playIntro ? null : false);
  const completionRef = useRef(onIntroComplete);
  const completedRef = useRef(false);
  const initialVisualState = useRef(resolveStartupVisualState(playIntro)).current;
  const dawnProgress = useRef(new Animated.Value(initialVisualState.dawnProgress)).current;
  const logoOpacity = useRef(new Animated.Value(initialVisualState.logoOpacity)).current;
  const logoScale = useRef(new Animated.Value(initialVisualState.logoScale)).current;
  const logoLift = useRef(new Animated.Value(initialVisualState.logoLift)).current;
  const sceneOpacity = useRef(new Animated.Value(initialVisualState.sceneOpacity)).current;
  const sweepProgress = useRef(new Animated.Value(0)).current;
  const flockProgress = useRef(FLOCK.map(() => new Animated.Value(0))).current;

  completionRef.current = onIntroComplete;

  useEffect(() => {
    if (!playIntro) {
      const waitingVisualState = resolveStartupVisualState(false);
      dawnProgress.setValue(waitingVisualState.dawnProgress);
      logoLift.setValue(waitingVisualState.logoLift);
      logoOpacity.setValue(waitingVisualState.logoOpacity);
      logoScale.setValue(waitingVisualState.logoScale);
      sceneOpacity.setValue(waitingVisualState.sceneOpacity);
      setReduceMotion(false);
      return undefined;
    }

    let active = true;
    const controller = new AbortController();

    resolveReducedMotionPreference(
      () => AccessibilityInfo.isReduceMotionEnabled(),
      400,
      controller.signal,
    ).then((enabled) => {
      if (active) setReduceMotion(enabled);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [dawnProgress, logoLift, logoOpacity, logoScale, playIntro, sceneOpacity]);

  useEffect(() => {
    if (!playIntro || reduceMotion === null || completedRef.current) return undefined;

    const finish = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      completionRef.current?.();
    };

    if (reduceMotion) {
      const reducedAnimation = Animated.sequence([
        Animated.parallel([
          Animated.timing(dawnProgress, {
            duration: 420,
            easing: Easing.out(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(logoOpacity, {
            duration: 380,
            easing: Easing.out(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            duration: 420,
            easing: Easing.out(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(logoLift, {
            duration: 420,
            easing: Easing.out(Easing.cubic),
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(180),
      ]);

      reducedAnimation.start(({ finished }) => {
        if (finished) finish();
      });
      return () => reducedAnimation.stop();
    }

    const reveal = Animated.parallel([
      Animated.timing(dawnProgress, {
        duration: 1380,
        easing: Easing.inOut(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(650),
        Animated.parallel([
          Animated.timing(logoOpacity, {
            duration: 520,
            easing: Easing.out(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            duration: 620,
            easing: Easing.out(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(logoLift, {
            duration: 620,
            easing: Easing.out(Easing.cubic),
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(820),
        Animated.timing(sweepProgress, {
          duration: 780,
          easing: Easing.inOut(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      ...FLOCK.map((bird, index) => (
        Animated.sequence([
          Animated.delay(bird.delay),
          Animated.timing(flockProgress[index], {
            duration: bird.duration,
            easing: Easing.inOut(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
        ])
      )),
    ]);

    const introAnimation = Animated.sequence([
      reveal,
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(sceneOpacity, {
          duration: 260,
          easing: Easing.in(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(logoLift, {
          duration: 260,
          easing: Easing.in(Easing.quad),
          toValue: -12,
          useNativeDriver: true,
        }),
      ]),
    ]);

    introAnimation.start(({ finished }) => {
      if (finished) finish();
    });

    return () => introAnimation.stop();
  }, [
    dawnProgress,
    flockProgress,
    logoLift,
    logoOpacity,
    logoScale,
    playIntro,
    reduceMotion,
    sceneOpacity,
    sweepProgress,
  ]);

  const birdPaths: BirdPath[] = [
    {
      x: [-width * 0.7, -width * 0.24, width * 0.16, width * 0.72],
      y: [height * 0.14, -height * 0.02, -height * 0.1, -height * 0.27],
    },
    {
      x: [-width * 0.62, -width * 0.18, width * 0.22, width * 0.64],
      y: [height * 0.24, height * 0.09, -height * 0.04, -height * 0.2],
    },
    {
      x: [width * 0.66, width * 0.2, -width * 0.16, -width * 0.68],
      y: [height * 0.08, -height * 0.05, -height * 0.12, -height * 0.3],
    },
    {
      x: [-width * 0.58, -width * 0.12, width * 0.28, width * 0.62],
      y: [height * 0.3, height * 0.13, height * 0.01, -height * 0.16],
    },
  ];

  const horizonOpacity = dawnProgress.interpolate({
    inputRange: [0, 0.28, 1],
    outputRange: [0.04, 0.18, 0.58],
  });
  const horizonScale = dawnProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.68, 1.18],
  });
  const skyVeilOpacity = dawnProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 0],
  });

  return (
    <View
      accessibilityLabel={playIntro ? 'Opening Property Peace' : 'Getting Property Peace ready'}
      accessibilityRole="progressbar"
      style={styles.container}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: sceneOpacity }]}>
        <LinearGradient
          colors={['#061e35', '#0a2d52', '#0d2040']}
          locations={[0, 0.58, 1]}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.horizonGlow,
            {
              opacity: horizonOpacity,
              transform: [{ scale: horizonScale }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.skyVeil, { opacity: skyVeilOpacity }]}
        />

        {playIntro && reduceMotion === false && FLOCK.map((bird, index) => (
          <BirdSilhouette
            key={bird.delay}
            path={birdPaths[index]}
            progress={flockProgress[index]}
            size={bird.size}
            tone={bird.tone}
            viewportHeight={height}
            viewportWidth={width}
          />
        ))}

        <Animated.View
          style={[
            styles.logoStage,
            {
              opacity: logoOpacity,
              transform: [{ translateY: logoLift }, { scale: logoScale }],
            },
          ]}
        >
          <View style={styles.logoFrame}>
            <Image accessibilityIgnoresInvertColors source={logo} style={styles.logo} />
            {playIntro && reduceMotion === false && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.lightSweep,
                  {
                    opacity: sweepProgress.interpolate({
                      inputRange: [0, 0.08, 0.78, 1],
                      outputRange: [0, 0.5, 0.32, 0],
                    }),
                    transform: [
                      {
                        translateX: sweepProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-220, 270],
                        }),
                      },
                      { rotate: '12deg' },
                    ],
                  },
                ]}
              />
            )}
          </View>
        </Animated.View>

        {!playIntro && (
          <View style={styles.waiting}>
            <ActivityIndicator color="#70cf73" size="small" />
            <Text style={styles.waitingText}>Getting your home ready…</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#061e35',
    flex: 1,
    overflow: 'hidden',
  },
  horizonGlow: {
    backgroundColor: 'rgba(99, 210, 179, 0.7)',
    borderRadius: 999,
    bottom: -250,
    height: 440,
    left: '50%',
    marginLeft: -260,
    position: 'absolute',
    width: 520,
  },
  skyVeil: {
    backgroundColor: '#020b15',
    ...StyleSheet.absoluteFillObject,
  },
  logoStage: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 20,
    width: '100%',
    zIndex: 3,
  },
  logoFrame: {
    alignItems: 'center',
    height: 122,
    justifyContent: 'center',
    maxWidth: 370,
    overflow: 'hidden',
    width: '94%',
  },
  logo: {
    height: 98,
    resizeMode: 'contain',
    width: '100%',
  },
  lightSweep: {
    backgroundColor: 'rgba(222, 255, 242, 0.78)',
    height: 170,
    position: 'absolute',
    width: 54,
  },
  bird: {
    position: 'absolute',
    zIndex: 2,
  },
  wing: {
    borderRadius: 999,
    position: 'absolute',
    top: '48%',
  },
  wingLeft: {
    left: '4%',
    transformOrigin: 'right center',
  },
  wingRight: {
    right: '4%',
    transformOrigin: 'left center',
  },
  waiting: {
    alignItems: 'center',
    bottom: '23%',
    gap: 10,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  waitingText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.25,
  },
});
