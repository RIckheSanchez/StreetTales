import {useState, useEffect, useRef, useCallback} from 'react';
import Voice from '@react-native-voice/voice';

const SILENCE_TIMEOUT_MS = 3000;

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const silenceTimer = useRef(null);
  // ref always holds the latest transcript — safe to read inside async callbacks
  const transcriptRef = useRef('');

  useEffect(() => {
    Voice.onSpeechResults = e => {
      const text = e.value?.[0] ?? '';
      transcriptRef.current = text;
      setTranscript(text);
      resetSilenceTimer();
    };
    Voice.onSpeechPartialResults = e => {
      const text = e.value?.[0] ?? '';
      transcriptRef.current = text;
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
      transcriptRef.current = '';
      setIsListening(true);
      await Voice.start('zh-CN');
      resetSilenceTimer();
    } catch (e) {
      setError(e.message);
      setIsListening(false);
    }
  }, []);

  // Returns the final transcript so callers don't rely on stale state
  const stopListening = useCallback(async () => {
    try {
      clearTimeout(silenceTimer.current);
      await Voice.stop();
      setIsListening(false);
      // Give the engine up to 600ms to fire its last onSpeechResults
      await new Promise(resolve => setTimeout(resolve, 600));
      return transcriptRef.current;
    } catch (e) {
      setError(e.message);
      return transcriptRef.current;
    }
  }, []);

  return {isListening, transcript, transcriptRef, startListening, stopListening, error};
}
