import {useState, useRef, useCallback} from 'react';

// Stub hook — actual input is handled via text modal in MainScreen.
// Replace this with a real ASR implementation (iFlytek / Baidu / Whisper) when ready.
export function useSpeechRecognition() {
  const [isListening] = useState(false);
  const [transcript] = useState('');
  const [error] = useState(null);
  const transcriptRef = useRef('');

  const startListening = useCallback(async () => {}, []);
  const stopListening = useCallback(async () => transcriptRef.current, []);

  return {isListening, transcript, transcriptRef, startListening, stopListening, error};
}
