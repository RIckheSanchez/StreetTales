import React, {useRef, useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import CameraView from '../components/CameraView';
import VoiceButton from '../components/VoiceButton';
import StoryOverlay from '../components/StoryOverlay';
import LoadingIndicator from '../components/LoadingIndicator';

import {useSpeechRecognition} from '../hooks/useSpeechRecognition';
import {useTTS} from '../hooks/useTTS';
import {useLocation} from '../hooks/useLocation';

import {identifyBuilding, generateStory} from '../api/claudeApi';
import {searchWikipedia, searchWikipediaByCoords} from '../api/wikipediaApi';
import {detectLandmark} from '../api/landmarkApi';

import {parseDirection} from '../utils/directionParser';
import {cropImageByDirection} from '../utils/imageCropper';
import {formatForTTS} from '../utils/storyFormatter';
import {saveStory} from '../storage/storyStorage';

const STATUS = {
  IDLE: 'idle',
  LISTENING: 'listening',
  IDENTIFYING: 'identifying',
  SEARCHING: 'searching',
  GENERATING: 'generating',
  SPEAKING: 'speaking',
};

const OVERLAY_AUTO_CLOSE_MS = 10000;

export default function MainScreen({navigation}) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);

  const [appStatus, setAppStatus] = useState(STATUS.IDLE);
  const [statusMessage, setStatusMessage] = useState('长按麦克风，开始提问');
  const [currentBuilding, setCurrentBuilding] = useState(null);
  const [currentStory, setCurrentStory] = useState('');
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  const autoCloseTimer = useRef(null);

  const {isListening, transcript, startListening, stopListening} =
    useSpeechRecognition();
  const {speak, stop, pause, resume, isSpeaking, isPaused, progress} = useTTS();
  const {latitude, longitude} = useLocation();

  useEffect(() => {
    requestPermissions();
  }, []);

  async function requestPermissions() {
    if (Platform.OS !== 'android') {
      setPermissionsGranted(true);
      return;
    }
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
    const granted =
      results[PermissionsAndroid.PERMISSIONS.CAMERA] === 'granted' &&
      results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 'granted';
    setPermissionsGranted(granted);
    if (!granted) {
      Alert.alert('权限不足', '需要摄像头和麦克风权限才能使用 StreetTales');
    }
  }

  useEffect(() => {
    if (!isSpeaking && !isPaused && appStatus === STATUS.SPEAKING) {
      // TTS finished naturally
      scheduleAutoClose();
    }
  }, [isSpeaking, isPaused]);

  function scheduleAutoClose() {
    clearTimeout(autoCloseTimer.current);
    autoCloseTimer.current = setTimeout(() => {
      setOverlayVisible(false);
      setAppStatus(STATUS.IDLE);
      setStatusMessage('长按麦克风，开始提问');
    }, OVERLAY_AUTO_CLOSE_MS);
  }

  const handlePressIn = useCallback(async () => {
    if (appStatus !== STATUS.IDLE) return;
    stop();
    setOverlayVisible(false);
    setAppStatus(STATUS.LISTENING);
    setStatusMessage('在听...');
    await startListening();
  }, [appStatus, stop, startListening]);

  const handlePressOut = useCallback(async () => {
    if (appStatus !== STATUS.LISTENING) return;
    await stopListening();
    await processQuery(transcript || '');
  }, [appStatus, stopListening, transcript]);

  async function processQuery(question) {
    if (!question.trim()) {
      setAppStatus(STATUS.IDLE);
      setStatusMessage('没有听清楚，请再试一次');
      return;
    }

    setStatusMessage(question);

    try {
      // Step a: Capture + identify
      setAppStatus(STATUS.IDENTIFYING);
      const photo = await cameraRef.current?.takeSnapshot();
      if (!photo) throw new Error('Camera snapshot failed');

      const direction = parseDirection(question);
      const {cropped, full} = await cropImageByDirection(
        photo.path,
        direction,
        photo.width ?? 1920,
        photo.height ?? 1080,
      );

      const [buildingInfo, landmark] = await Promise.all([
        identifyBuilding(cropped ?? full, direction, question),
        detectLandmark(full),
      ]);

      const resolvedBuilding = mergeResults(buildingInfo, landmark);

      if (!resolvedBuilding?.name && resolvedBuilding?.confidence === 'low') {
        showFallbackMessage('这个地方比较神秘，暂时找不到它的故事');
        return;
      }

      setCurrentBuilding(resolvedBuilding);

      // Step b: Wikipedia search (parallel)
      setAppStatus(STATUS.SEARCHING);
      const keyword = resolvedBuilding?.searchKeyword ?? resolvedBuilding?.name;
      const [wikiByName, nearbyPlaces] = await Promise.all([
        keyword ? searchWikipedia(keyword, 'zh') : null,
        searchWikipediaByCoords(latitude, longitude),
      ]);

      let wikiContent = wikiByName?.extract ?? '';
      if (!wikiContent && nearbyPlaces.length > 0) {
        const nearbyResult = await searchWikipedia(nearbyPlaces[0].title, 'en');
        wikiContent = nearbyResult?.extract ?? '';
      }

      if (!wikiContent && resolvedBuilding?.confidence === 'low') {
        showFallbackMessage('这个地方比较神秘，暂时找不到它的故事');
        return;
      }

      // Step c: Generate story
      setAppStatus(STATUS.GENERATING);
      const rawStory = await generateStory(resolvedBuilding, wikiContent, question);
      if (!rawStory) throw new Error('Story generation failed');

      const formattedStory = formatForTTS(rawStory);
      setCurrentStory(formattedStory);
      setOverlayVisible(true);
      setAppStatus(STATUS.SPEAKING);
      setStatusMessage('');

      // Step d: Speak + save
      speak(formattedStory);

      await saveStory({
        id: Date.now().toString(),
        timestamp: Date.now(),
        buildingName: resolvedBuilding?.name ?? '未知建筑',
        buildingType: resolvedBuilding?.type ?? '',
        storyText: formattedStory,
        location: {lat: latitude, lng: longitude},
        imageBase64: full,
      });
    } catch (error) {
      console.error('processQuery error:', error);
      showFallbackMessage('网络开小差了，请稍后再试');
    }
  }

  function mergeResults(claudeResult, landmarkResult) {
    if (!claudeResult && !landmarkResult) return null;
    if (!claudeResult) {
      return {
        name: landmarkResult.name,
        type: '地标',
        searchKeyword: landmarkResult.name,
        confidence: landmarkResult.confidence > 0.7 ? 'high' : 'medium',
        description: '',
      };
    }
    if (landmarkResult?.name && claudeResult.confidence === 'low') {
      return {
        ...claudeResult,
        name: landmarkResult.name,
        searchKeyword: landmarkResult.name,
        confidence: 'medium',
      };
    }
    return claudeResult;
  }

  function showFallbackMessage(message) {
    setAppStatus(STATUS.SPEAKING);
    setCurrentBuilding({name: null, type: null});
    setCurrentStory(message);
    setOverlayVisible(true);
    speak(message);
    scheduleAutoClose();
  }

  function handleOverlayTap() {
    if (isSpeaking) {
      pause();
    } else if (isPaused) {
      resume();
    }
  }

  function handleOverlayClose() {
    stop();
    clearTimeout(autoCloseTimer.current);
    setOverlayVisible(false);
    setAppStatus(STATUS.IDLE);
    setStatusMessage('长按麦克风，开始提问');
  }

  const loadingPhase =
    appStatus === STATUS.IDENTIFYING
      ? 'identifying'
      : appStatus === STATUS.SEARCHING
      ? 'searching'
      : appStatus === STATUS.GENERATING
      ? 'generating'
      : null;

  return (
    <View style={styles.root}>
      {permissionsGranted && <CameraView ref={cameraRef} />}

      {/* Top status bar */}
      <View style={[styles.topBar, {top: insets.top + 8}]}>
        {loadingPhase ? (
          <LoadingIndicator phase={loadingPhase} />
        ) : statusMessage ? (
          <View style={styles.statusPill}>
            <Text style={styles.statusText} numberOfLines={2}>
              {statusMessage}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomBar, {paddingBottom: insets.bottom + 16}]}>
        <TouchableOpacity
          style={styles.historyBtn}
          onPress={() => navigation.navigate('History')}>
          <Icon name="history" size={28} color="#fff" />
          <Text style={styles.historyLabel}>历史</Text>
        </TouchableOpacity>

        <VoiceButton
          isListening={isListening}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        />

        <View style={styles.spacer} />
      </View>

      {/* Story overlay */}
      <StoryOverlay
        visible={overlayVisible}
        buildingName={currentBuilding?.name}
        buildingType={currentBuilding?.type}
        storyText={currentStory}
        isSpeaking={isSpeaking}
        isPaused={isPaused}
        progress={progress}
        onPauseResume={handleOverlayTap}
        onClose={handleOverlayClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 10,
  },
  statusPill: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    maxWidth: '85%',
  },
  statusText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
    zIndex: 10,
  },
  historyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  historyLabel: {
    color: '#fff',
    fontSize: 11,
    marginTop: 2,
  },
  spacer: {width: 56},
});
