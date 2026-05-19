import {useState, useEffect, useCallback} from 'react';
import Tts from 'react-native-tts';

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    Tts.setDefaultLanguage('zh-CN');
    Tts.setDefaultRate(0.45);
    Tts.setDefaultPitch(1.0);

    const startSub = Tts.addEventListener('tts-start', () => {
      setIsSpeaking(true);
      setIsPaused(false);
    });
    const finishSub = Tts.addEventListener('tts-finish', () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setProgress(0);
    });
    const cancelSub = Tts.addEventListener('tts-cancel', () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setProgress(0);
    });
    const progressSub = Tts.addEventListener('tts-progress', e => {
      if (e.end && e.start != null) {
        setProgress(e.end);
      }
    });

    return () => {
      startSub?.remove?.();
      finishSub?.remove?.();
      cancelSub?.remove?.();
      progressSub?.remove?.();
    };
  }, []);

  const speak = useCallback(text => {
    if (!text) return;
    Tts.stop();
    setProgress(0);
    Tts.speak(text);
  }, []);

  const stop = useCallback(() => {
    Tts.stop();
  }, []);

  const pause = useCallback(() => {
    Tts.pause();
    setIsPaused(true);
    setIsSpeaking(false);
  }, []);

  const resume = useCallback(() => {
    Tts.resume();
    setIsPaused(false);
    setIsSpeaking(true);
  }, []);

  return {speak, stop, pause, resume, isSpeaking, isPaused, progress};
}
