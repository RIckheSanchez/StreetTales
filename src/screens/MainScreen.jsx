import React, {useRef, useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Modal,
  PermissionsAndroid,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import CameraView from '../components/CameraView';
import StoryOverlay from '../components/StoryOverlay';
import LoadingIndicator from '../components/LoadingIndicator';

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
  IDENTIFYING: 'identifying',
  SEARCHING: 'searching',
  GENERATING: 'generating',
  SPEAKING: 'speaking',
};

const OVERLAY_AUTO_CLOSE_MS = 10000;

const QUICK_QUESTIONS = [
  '右边那栋楼有什么故事？',
  '左边那个建筑是什么来历？',
  '前面那个地标有什么历史？',
  '这附近有什么有名的建筑吗？',
  '这是什么地方？',
];

export default function MainScreen({navigation}) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);

  const [appStatus, setAppStatus] = useState(STATUS.IDLE);
  const [statusMessage, setStatusMessage] = useState('点麦克风，开始提问');
  const [currentBuilding, setCurrentBuilding] = useState(null);
  const [currentStory, setCurrentStory] = useState('');
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputText, setInputText] = useState('');

  const autoCloseTimer = useRef(null);
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
      Alert.alert('权限不足', '需要摄像头权限才能使用 StreetTales');
    }
  }

  useEffect(() => {
    if (!isSpeaking && !isPaused && appStatus === STATUS.SPEAKING) {
      scheduleAutoClose();
    }
  }, [isSpeaking, isPaused]);

  function scheduleAutoClose() {
    clearTimeout(autoCloseTimer.current);
    autoCloseTimer.current = setTimeout(() => {
      setOverlayVisible(false);
      setAppStatus(STATUS.IDLE);
      setStatusMessage('点麦克风，开始提问');
    }, OVERLAY_AUTO_CLOSE_MS);
  }

  function handleMicPress() {
    if (appStatus !== STATUS.IDLE) return;
    stop();
    setOverlayVisible(false);
    setInputText('');
    setInputVisible(true);
  }

  function handleQuickQuestion(q) {
    setInputVisible(false);
    processQuery(q);
  }

  function handleCustomSubmit() {
    const q = inputText.trim();
    setInputVisible(false);
    if (q) processQuery(q);
  }

  async function processQuery(question) {
    if (!question.trim()) {
      setStatusMessage('请输入问题后再试');
      return;
    }

    setStatusMessage(question);

    try {
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

      setAppStatus(STATUS.GENERATING);
      const rawStory = await generateStory(resolvedBuilding, wikiContent, question);
      if (!rawStory) throw new Error('Story generation failed');

      const formattedStory = formatForTTS(rawStory);
      setCurrentStory(formattedStory);
      setOverlayVisible(true);
      setAppStatus(STATUS.SPEAKING);
      setStatusMessage('');

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
    if (isSpeaking) pause();
    else if (isPaused) resume();
  }

  function handleOverlayClose() {
    stop();
    clearTimeout(autoCloseTimer.current);
    setOverlayVisible(false);
    setAppStatus(STATUS.IDLE);
    setStatusMessage('点麦克风，开始提问');
  }

  const loadingPhase =
    appStatus === STATUS.IDENTIFYING ? 'identifying' :
    appStatus === STATUS.SEARCHING   ? 'searching' :
    appStatus === STATUS.GENERATING  ? 'generating' : null;

  return (
    <View style={styles.root}>
      {permissionsGranted && <CameraView ref={cameraRef} />}

      {/* Top status */}
      <View style={[styles.topBar, {top: insets.top + 8}]}>
        {loadingPhase ? (
          <LoadingIndicator phase={loadingPhase} />
        ) : statusMessage ? (
          <View style={styles.statusPill}>
            <Text style={styles.statusText} numberOfLines={2}>{statusMessage}</Text>
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

        <TouchableOpacity
          style={[styles.micBtn, appStatus !== STATUS.IDLE && styles.micBtnDisabled]}
          onPress={handleMicPress}
          activeOpacity={0.8}>
          <Icon name="mic" size={36} color="#fff" />
        </TouchableOpacity>

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

      {/* Question input modal */}
      <Modal
        visible={inputVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInputVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setInputVisible(false)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalSheet}>
          <Text style={styles.modalTitle}>你想问什么？</Text>

          {/* Quick questions */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRow}>
            {QUICK_QUESTIONS.map(q => (
              <TouchableOpacity
                key={q}
                style={styles.quickBtn}
                onPress={() => handleQuickQuestion(q)}>
                <Text style={styles.quickText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Custom input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="或者自定义问题..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleCustomSubmit}
              returnKeyType="go"
              autoFocus
              multiline={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={handleCustomSubmit}
              disabled={!inputText.trim()}>
              <Icon name="arrow-forward" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  historyLabel: {color: '#fff', fontSize: 11, marginTop: 2},
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  micBtnDisabled: {opacity: 0.4},
  spacer: {width: 56},
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  quickRow: {
    paddingBottom: 16,
    gap: 8,
  },
  quickBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  quickText: {
    color: '#fff',
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 10,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {backgroundColor: 'rgba(229,57,53,0.3)'},
});
