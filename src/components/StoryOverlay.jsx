import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {BlurView} from '@react-native-community/blur';
import Icon from 'react-native-vector-icons/MaterialIcons';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');
const OVERLAY_HEIGHT = SCREEN_HEIGHT * 0.52;

export default function StoryOverlay({
  visible,
  buildingName,
  buildingType,
  storyText,
  isSpeaking,
  isPaused,
  progress,
  onPauseResume,
  onClose,
}) {
  const translateY = useSharedValue(OVERLAY_HEIGHT);
  const scrollRef = useRef(null);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : OVERLAY_HEIGHT, {
      duration: 380,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{translateY: translateY.value}],
  }));

  function renderHighlightedText() {
    if (!storyText) return null;
    if (!isSpeaking && !isPaused) {
      return <Text style={styles.storyText}>{storyText}</Text>;
    }

    const spoken = storyText.slice(0, progress);
    const unspoken = storyText.slice(progress);
    return (
      <Text style={styles.storyText}>
        <Text style={styles.spokenText}>{spoken}</Text>
        {unspoken}
      </Text>
    );
  }

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType="dark"
        blurAmount={18}
        reducedTransparencyFallbackColor="rgba(10,10,20,0.92)"
      />
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.buildingName} numberOfLines={1}>
              {buildingName || '未知建筑'}
            </Text>
            {buildingType ? (
              <Text style={styles.buildingType}>{buildingType}</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Icon name="close" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {renderHighlightedText()}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity onPress={onPauseResume} style={styles.playBtn}>
            <Icon
              name={isSpeaking ? 'pause' : 'play-arrow'}
              size={28}
              color="#fff"
            />
            <Text style={styles.playLabel}>
              {isSpeaking ? '暂停' : isPaused ? '继续' : '播放'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: OVERLAY_HEIGHT,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleBlock: {flex: 1},
  buildingName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  buildingType: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },
  closeBtn: {
    paddingLeft: 12,
    paddingTop: 4,
  },
  scroll: {flex: 1},
  scrollContent: {paddingBottom: 8},
  storyText: {
    fontSize: 16,
    lineHeight: 28,
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.3,
  },
  spokenText: {
    color: '#fff',
    fontWeight: '600',
  },
  footer: {
    paddingTop: 12,
    alignItems: 'center',
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
  },
  playLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
