import {useState, useEffect, useRef, useCallback} from 'react';
import Voice from '@react-native-voice/voice';

const SILENCE_TIMEOUT_MS = 3000;

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const silenceTimer = useRef(null);

  useEffect(() => {
    Voice.onSpeechResults = e => {
      const text = e.value?.[0] ?? '';
      setTranscript(text);
      resetSilenceTimer();
    };
    Voice.onSpeechPartialResults = e => {
      const text = e.value?.[0] ?? '';
      setTranscript(text);
      resetSilenceTimer();
    };
    Voice.onSpeechError = e => {
      setError(e.error?.message ?? 'Speech error');
      setIsListening(false);
    };
    Voice.onSpeechEnd = () => {
      setIsListening(false);
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
      clearTimeout(silenceTimer.current);
    };
  }, []);

  function resetSilenceTimer() {
    clearTimeout(silenceTimer.current);
    silenceTimer.current = setTimeout(() => {
      stopListening();
    }, SILENCE_TIMEOUT_MS);
  }

  const startListening = useCallback(async () => {
    try {
      setError(null);
      setTranscript('');
      setIsListening(true);
      await Voice.start('zh-CN');
      resetSilenceTimer();
    } catch (e) {
      setError(e.message);
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(async () => {
    try {
      clearTimeout(silenceTimer.current);
      await Voice.stop();
      setIsListening(false);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  return {isListening, transcript, startListening, stopListening, error};
}
