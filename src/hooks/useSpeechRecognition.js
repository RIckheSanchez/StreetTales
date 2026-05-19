import {useState, useEffect, useRef, useCallback} from 'react';
import {NativeModules, NativeEventEmitter} from 'react-native';

const {SpeechModule} = NativeModules;
const emitter = SpeechModule ? new NativeEventEmitter(SpeechModule) : null;

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const transcriptRef = useRef('');
  const silenceTimer = useRef(null);

  useEffect(() => {
    if (!emitter) {
      console.warn('[Speech] SpeechModule not available');
      return;
    }

    const subs = [
      emitter.addListener('SpeechStart', () => {
        console.log('[Speech] started');
        setIsListening(true);
      }),
      emitter.addListener('SpeechEnd', () => {
        console.log('[Speech] ended');
        setIsListening(false);
        clearTimeout(silenceTimer.current);
      }),
      emitter.addListener('SpeechResult', matches => {
        const text = Array.isArray(matches) ? matches[0] : matches;
        console.log('[Speech] result:', text);
        if (text) {
          transcriptRef.current = text;
          setTranscript(text);
        }
      }),
      emitter.addListener('SpeechError', msg => {
        console.log('[Speech] error:', msg);
        setError(msg);
        setIsListening(false);
        clearTimeout(silenceTimer.current);
      }),
    ];

    return () => subs.forEach(s => s.remove());
  }, []);

  const startListening = useCallback(async () => {
    if (!SpeechModule) {
      setError('SpeechModule 未加载');
      return;
    }
    try {
      setError(null);
      setTranscript('');
      transcriptRef.current = '';
      console.log('[Speech] calling startListening');
      await SpeechModule.startListening('zh-CN');
    } catch (e) {
      console.log('[Speech] startListening error:', e.message);
      setError(e.message);
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(async () => {
    if (!SpeechModule) return '';
    try {
      clearTimeout(silenceTimer.current);
      await SpeechModule.stopListening();
      setIsListening(false);
      // Wait for final result event
      await new Promise(resolve => setTimeout(resolve, 800));
      console.log('[Speech] stopListening, transcript:', transcriptRef.current);
      return transcriptRef.current;
    } catch (e) {
      console.log('[Speech] stopListening error:', e.message);
      return transcriptRef.current;
    }
  }, []);

  return {isListening, transcript, transcriptRef, startListening, stopListening, error};
}
