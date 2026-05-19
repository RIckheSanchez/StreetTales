import React, {useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const PHASES = {
  identifying: {icon: '👁', label: '识别建筑中...'},
  searching: {icon: '📖', label: '查找历史资料...'},
  generating: {icon: '✏️', label: '生成故事...'},
};

export default function LoadingIndicator({phase}) {
  const scaleY = useSharedValue(1);
  const rotation = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    scaleY.value = 1;
    rotation.value = 0;
    translateX.value = 0;

    if (phase === 'identifying') {
      scaleY.value = withRepeat(
        withSequence(
          withTiming(0.4, {duration: 300, easing: Easing.inOut(Easing.ease)}),
          withTiming(1.0, {duration: 300, easing: Easing.inOut(Easing.ease)}),
        ),
        -1,
        false,
      );
    } else if (phase === 'searching') {
      rotation.value = withRepeat(
        withSequence(
          withTiming(-15, {duration: 250}),
          withTiming(15, {duration: 250}),
          withTiming(0, {duration: 250}),
        ),
        -1,
        false,
      );
    } else if (phase === 'generating') {
      translateX.value = withRepeat(
        withSequence(
          withTiming(8, {duration: 200}),
          withTiming(0, {duration: 200}),
        ),
        -1,
        false,
      );
    }
  }, [phase]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      {scaleY: scaleY.value},
      {rotate: `${rotation.value}deg`},
      {translateX: translateX.value},
    ],
  }));

  const info = PHASES[phase];
  if (!info) return null;

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.icon, iconStyle]}>{info.icon}</Animated.Text>
      <Text style={styles.label}>{info.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  icon: {fontSize: 20},
  label: {color: '#fff', fontSize: 15, fontWeight: '600'},
});
