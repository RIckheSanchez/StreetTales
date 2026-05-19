import React, {useEffect} from 'react';
import {StyleSheet, Pressable, View, Text} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialIcons';

const BUTTON_SIZE = 80;
const PULSE_SIZE = BUTTON_SIZE + 24;

export default function VoiceButton({isListening, onPressIn, onPressOut}) {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  useEffect(() => {
    if (isListening) {
      pulseOpacity.value = withTiming(0.5, {duration: 200});
      pulseScale.value = withRepeat(
        withTiming(1.4, {duration: 800, easing: Easing.out(Easing.ease)}),
        -1,
        true,
      );
    } else {
      pulseOpacity.value = withTiming(0, {duration: 200});
      pulseScale.value = withTiming(1, {duration: 200});
    }
  }, [isListening]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{scale: pulseScale.value}],
    opacity: pulseOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.pulse, pulseStyle]} />
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.button, isListening && styles.buttonActive]}>
        <Icon
          name="mic"
          size={36}
          color="#fff"
        />
        {isListening && (
          <Text style={styles.hint}>松手停止</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: PULSE_SIZE + 24,
    height: PULSE_SIZE + 24,
  },
  pulse: {
    position: 'absolute',
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    backgroundColor: '#e53935',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  buttonActive: {
    backgroundColor: '#e53935',
    borderColor: '#ffcdd2',
  },
  hint: {
    position: 'absolute',
    bottom: -22,
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
});
