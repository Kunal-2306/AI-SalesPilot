import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Square,
  Send,
  Sparkles,
  BookOpen,
  CalendarCheck,
  UserCheck,
  AlertCircle,
  Radio,
  KeyRound,
  RefreshCw,
  Languages,
} from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';

const CALL_STATES = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  LISTENING: 'LISTENING',
  RECORDING: 'RECORDING',
  TRANSCRIBING: 'TRANSCRIBING',
  THINKING: 'THINKING',
  SPEAKING: 'SPEAKING',
  INTERRUPTED: 'INTERRUPTED',
  MUTED: 'MUTED',
  TEXT_ONLY: 'TEXT_ONLY',
  ERROR: 'ERROR',
  ENDED: 'ENDED',
};

const ACTIVE_CALL_STATES = new Set([
  CALL_STATES.CONNECTING,
  CALL_STATES.LISTENING,
  CALL_STATES.RECORDING,
  CALL_STATES.TRANSCRIBING,
  CALL_STATES.THINKING,
  CALL_STATES.SPEAKING,
  CALL_STATES.INTERRUPTED,
  CALL_STATES.MUTED,
  CALL_STATES.TEXT_ONLY,
  CALL_STATES.ERROR,
]);

export default function VoiceAgentPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const hasGroqKey = Boolean(user?.aiSettings?.hasGroqKey);
  const sttProvider = user?.voiceSettings?.sttProvider || 'groq';
  const ttsProvider = user?.voiceSettings?.ttsProvider || 'browser';
  const groqModel = user?.aiSettings?.model || 'openai/gpt-oss-120b';
  const groqSttModel = user?.aiSettings?.sttModel || 'whisper-large-v3-turbo';

  const [callId, setCallId] = useState(null);
  const [callStatus, setCallStatus] = useState(CALL_STATES.IDLE);
  const [language, setLanguage] = useState(user?.voiceSettings?.language || 'auto');
  const [autoListen, setAutoListen] = useState(user?.voiceSettings?.autoListen ?? true);
  const [silenceDurationMs, setSilenceDurationMs] = useState(1000);
  const [muted, setMuted] = useState(false);
  const [recordingMode, setRecordingMode] = useState(null); // null | 'vad' | 'manual'
  const [micPermission, setMicPermission] = useState('prompt');
  const [micLevel, setMicLevel] = useState(0);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [speechSupported] = useState(
    () => typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [lead, setLead] = useState(null);
  const [bookedAppointment, setBookedAppointment] = useState(null);
  const [retrievedSources, setRetrievedSources] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryAction, setRetryAction] = useState(null);
  const [telemetry, setTelemetry] = useState({
    stt: sttProvider === 'webspeech' ? 'Browser Web Speech' : `Groq Whisper (${groqSttModel})`,
    llm: `Groq LLM (${groqModel})`,
    tts: ttsProvider === 'gemini' ? 'Google Gemini TTS' : 'Browser SpeechSynthesis',
    latencyMs: null,
    tokensUsed: null,
  });

  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recorderMimeRef = useRef('audio/webm');
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);

  // Refs for real-time VAD loop (avoids stale closures inside requestAnimationFrame)
  const callIdRef = useRef(null);
  const mutedRef = useRef(false);
  const statusRef = useRef(CALL_STATES.IDLE);
  const languageRef = useRef(language);
  const autoListenRef = useRef(autoListen);
  const silenceDurationRef = useRef(silenceDurationMs);
  const sttProviderRef = useRef(sttProvider);
  const recordingSourceRef = useRef(null); // null | 'vad' | 'manual'
  const inFlightRef = useRef(false);
  const discardSegmentRef = useRef(false);
  const speechStartTimeRef = useRef(0);
  const lastSpeechTimeRef = useRef(0);
  const speechFramesRef = useRef(0);
  const peakLevelRef = useRef(0);
  const noiseFloorRef = useRef(3.5);
  const cooldownUntilRef = useRef(0);
  const lastSubmittedFingerprintRef = useRef('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    statusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    autoListenRef.current = autoListen;
  }, [autoListen]);

  useEffect(() => {
    silenceDurationRef.current = silenceDurationMs;
  }, [silenceDurationMs]);

  useEffect(() => {
    sttProviderRef.current = sttProvider;
    setTelemetry((prev) => ({
      ...prev,
      stt: sttProvider === 'webspeech' ? 'Browser Web Speech' : `Groq Whisper (${groqSttModel})`,
      llm: `Groq LLM (${groqModel})`,
      tts: ttsProvider === 'gemini' ? 'Google Gemini TTS' : 'Browser SpeechSynthesis',
    }));
  }, [sttProvider, ttsProvider, groqModel, groqSttModel]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return undefined;
    const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices() || []);
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveTranscript]);

  useEffect(() => {
    if (
      ![
        CALL_STATES.CONNECTING,
        CALL_STATES.LISTENING,
        CALL_STATES.RECORDING,
        CALL_STATES.TRANSCRIBING,
        CALL_STATES.THINKING,
        CALL_STATES.SPEAKING,
        CALL_STATES.INTERRUPTED,
        CALL_STATES.MUTED,
        CALL_STATES.TEXT_ONLY,
      ].includes(callStatus)
    ) {
      return undefined;
    }
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  useEffect(() => {
    const token = localStorage.getItem('salespilot_token');
    if (!token) return undefined;
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const socket = io(socketUrl, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('call:turn', (payload) => {
      if (payload.callId === callIdRef.current) {
        if (payload.analysis) setAnalysis(payload.analysis);
        if (payload.lead) setLead(payload.lead);
        if (payload.bookedAppointment) setBookedAppointment(payload.bookedAppointment);
      }
    });
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      stopAudioResources();
    };
  }, []);

  const formatTimer = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const setMicTracksEnabled = (enabled) => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  };

  const cancelActiveRecording = () => {
    discardSegmentRef.current = true;
    recordingSourceRef.current = null;
    setRecordingMode(null);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch {}
    }
    audioChunksRef.current = [];
  };

  const stopAudioResources = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    cancelActiveRecording();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
  };

  const updateStatus = (nextStatus) => {
    statusRef.current = nextStatus;
    setCallStatus(nextStatus);
  };

  const resumeListeningIfActive = (delayMs = 300) => {
    if (!callIdRef.current || statusRef.current === CALL_STATES.ENDED) return;

    const activate = () => {
      if (!callIdRef.current || statusRef.current === CALL_STATES.ENDED) return;
      if (!streamRef.current) {
        updateStatus(CALL_STATES.TEXT_ONLY);
        return;
      }
      if (mutedRef.current) {
        setMicTracksEnabled(false);
        updateStatus(CALL_STATES.MUTED);
        return;
      }

      setMicTracksEnabled(true);
      cooldownUntilRef.current = performance.now() + 180;
      updateStatus(CALL_STATES.LISTENING);

      if (sttProviderRef.current === 'webspeech' && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {}
      }
    };

    if (delayMs > 0) {
      setTimeout(activate, delayMs);
    } else {
      activate();
    }
  };

  // Shared reusable transcription pipeline used by BOTH Auto VAD and Manual Record Voice
  const transcribeBlobWithGroq = async (blob, durationMs = 0) => {
    if (inFlightRef.current) return;
    if (!blob || blob.size < 1800) {
      resumeListeningIfActive(150);
      return;
    }

    const fingerprint = `${blob.size}_${Math.round(durationMs / 100)}`;
    if (fingerprint === lastSubmittedFingerprintRef.current) {
      resumeListeningIfActive(150);
      return;
    }

    inFlightRef.current = true;
    lastSubmittedFingerprintRef.current = fingerprint;
    setErrorMessage('');
    setRetryAction(null);
    updateStatus(CALL_STATES.TRANSCRIBING);

    const formData = new FormData();
    formData.append('audio', blob, 'speech.webm');
    formData.append('language', languageRef.current);

    try {
      const { data } = await api.post('/voice/stt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setTelemetry((prev) => ({
        ...prev,
        stt: `Groq Whisper (${data.model || groqSttModel})`,
      }));

      const transcript = (data.text || '').trim();
      if (!transcript) {
        inFlightRef.current = false;
        toast('No speech detected in audio segment. Listening again...', 'info');
        resumeListeningIfActive(200);
        return;
      }

      await sendCustomerTurn(transcript);
    } catch (err) {
      inFlightRef.current = false;
      const msg = err.response?.data?.message || 'Groq Whisper transcription failed.';
      setErrorMessage(msg);
      updateStatus(CALL_STATES.ERROR);
      setRetryAction({
        label: 'Retry Groq Transcription',
        run: () => {
          lastSubmittedFingerprintRef.current = '';
          transcribeBlobWithGroq(blob, durationMs);
        },
      });
      toast(msg, 'error');
    }
  };

  const startSegmentRecorder = (mode) => {
    if (!streamRef.current || !window.MediaRecorder || inFlightRef.current) return false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return false;

    try {
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType: recorderMimeRef.current,
      });
      audioChunksRef.current = [];
      discardSegmentRef.current = false;
      recordingSourceRef.current = mode;
      setRecordingMode(mode);

      const now = performance.now();
      speechStartTimeRef.current = now;
      lastSpeechTimeRef.current = now;
      speechFramesRef.current = 1;
      peakLevelRef.current = 0;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const wasDiscarded = discardSegmentRef.current;
        const sourceMode = recordingSourceRef.current;
        const durationMs = performance.now() - speechStartTimeRef.current;
        const activeFrames = speechFramesRef.current;
        const peak = peakLevelRef.current;
        const chunks = audioChunksRef.current.slice();

        audioChunksRef.current = [];
        recordingSourceRef.current = null;
        setRecordingMode(null);
        mediaRecorderRef.current = null;

        if (wasDiscarded || !callIdRef.current || statusRef.current === CALL_STATES.ENDED) {
          return;
        }

        const blob = new Blob(chunks, { type: recorderMimeRef.current || 'audio/webm' });

        // Filter out brief pops/noise for automatic VAD segments
        if (sourceMode === 'vad') {
          const minDurationMs = 550;
          const minFrames = 6;
          if (durationMs < minDurationMs || activeFrames < minFrames || blob.size < 2500 || peak < 9) {
            resumeListeningIfActive(100);
            return;
          }
        }

        await transcribeBlobWithGroq(blob, durationMs);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      updateStatus(CALL_STATES.RECORDING);
      return true;
    } catch {
      recordingSourceRef.current = null;
      setRecordingMode(null);
      return false;
    }
  };

  const stopSegmentRecorder = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
  };

  // Real-time Waveform + Voice Activity Detection (VAD) Loop
  const startAudioMonitorLoop = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const timeData = analyser ? new Uint8Array(analyser.fftSize) : null;
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      ctx.clearRect(0, 0, width, height);

      const bars = 44;
      const barWidth = (width - bars * 3) / bars;
      const currentStatus = statusRef.current;
      const isCapturing =
        analyser &&
        !mutedRef.current &&
        (currentStatus === CALL_STATES.LISTENING || currentStatus === CALL_STATES.RECORDING);

      let rmsLevel = 0;
      if (isCapturing && timeData && freqData) {
        analyser.getByteTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);

        let sumSq = 0;
        for (let i = 0; i < timeData.length; i += 1) {
          const centered = (timeData[i] - 128) / 128;
          sumSq += centered * centered;
        }
        const rms = Math.sqrt(sumSq / timeData.length);
        rmsLevel = Math.min(100, Math.round(rms * 320));
        setMicLevel(rmsLevel);

        // Adaptive Voice Activity Detection (Groq Whisper auto-capture)
        if (
          sttProviderRef.current === 'groq' &&
          autoListenRef.current &&
          !inFlightRef.current &&
          recordingSourceRef.current !== 'manual'
        ) {
          const now = performance.now();
          const onsetThreshold = Math.max(10, noiseFloorRef.current + 6.5);
          const sustainThreshold = Math.max(7, noiseFloorRef.current + 4.0);

          if (currentStatus === CALL_STATES.LISTENING && now >= cooldownUntilRef.current) {
            if (rmsLevel >= onsetThreshold) {
              const started = startSegmentRecorder('vad');
              if (started) {
                peakLevelRef.current = rmsLevel;
              }
            } else {
              // Slowly track ambient noise floor during quiet listening
              noiseFloorRef.current = Math.min(
                14,
                Math.max(2, noiseFloorRef.current * 0.96 + rmsLevel * 0.04)
              );
            }
          } else if (currentStatus === CALL_STATES.RECORDING && recordingSourceRef.current === 'vad') {
            if (rmsLevel >= sustainThreshold) {
              lastSpeechTimeRef.current = now;
              speechFramesRef.current += 1;
              if (rmsLevel > peakLevelRef.current) peakLevelRef.current = rmsLevel;
            }

            const silenceElapsed = now - lastSpeechTimeRef.current;
            const totalElapsed = now - speechStartTimeRef.current;

            if (silenceElapsed >= silenceDurationRef.current || totalElapsed >= 25000) {
              stopSegmentRecorder();
            }
          }
        }
      } else {
        setMicLevel(0);
      }

      for (let i = 0; i < bars; i += 1) {
        let level = 0.06;
        if (isCapturing && freqData) {
          const val = freqData[Math.floor((i * freqData.length) / bars)] || 0;
          level = Math.max(0.06, val / 255);
        } else if (currentStatus === CALL_STATES.SPEAKING) {
          level = 0.22 + 0.55 * Math.abs(Math.sin(Date.now() / 150 + i * 0.4));
        } else if (
          currentStatus === CALL_STATES.THINKING ||
          currentStatus === CALL_STATES.TRANSCRIBING
        ) {
          level = 0.14 + 0.18 * Math.abs(Math.sin(Date.now() / 240 + i * 0.3));
        }

        const barHeight = Math.max(4, level * (height - 14));
        const x = i * (barWidth + 3);
        const y = (height - barHeight) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (currentStatus === CALL_STATES.RECORDING) {
          gradient.addColorStop(0, '#fb7185');
          gradient.addColorStop(1, '#e11d48');
        } else if (currentStatus === CALL_STATES.SPEAKING) {
          gradient.addColorStop(0, '#818cf8');
          gradient.addColorStop(1, '#4f46e5');
        } else {
          gradient.addColorStop(0, '#38bdf8');
          gradient.addColorStop(1, '#4f46e5');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }
    };

    render();
  };

  const speakWithBrowserSynthesis = async (text, detectedLang) => {
    if (!('speechSynthesis' in window)) {
      toast('Browser SpeechSynthesis API is not supported on this device.', 'warning');
      return;
    }

    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    const targetLang = hasDevanagari || detectedLang === 'hi' || languageRef.current === 'hi' ? 'hi' : 'en';

    const voices = availableVoices.length ? availableVoices : window.speechSynthesis.getVoices() || [];
    const matchedVoice =
      voices.find((v) => v.lang?.toLowerCase().startsWith(`${targetLang}-`)) ||
      voices.find((v) => v.lang?.toLowerCase().startsWith(targetLang)) ||
      null;

    if (targetLang === 'hi' && !matchedVoice) {
      toast('No Hindi (hi-IN) system voice installed in browser; using default voice.', 'warning');
    }

    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(safetyTimer);
        resolve();
      };
      const safetyTimer = setTimeout(done, Math.max(4000, text.length * 80));

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = targetLang === 'hi' ? 'hi-IN' : 'en-US';
      if (matchedVoice) utterance.voice = matchedVoice;
      utterance.rate = user?.voiceSettings?.speechRate || 1.0;
      utterance.onend = done;
      utterance.onerror = done;
      window.speechSynthesis.speak(utterance);
    });
  };

  const speakResponse = async (text, detectedLang = 'en') => {
    // Pause & disable microphone capture while AI speaks to prevent acoustic feedback loops
    cancelActiveRecording();
    setMicTracksEnabled(false);
    updateStatus(CALL_STATES.SPEAKING);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    if (ttsProvider === 'gemini') {
      try {
        const response = await api.post(
          '/voice/tts',
          { text, provider: 'gemini' },
          { responseType: 'arraybuffer' }
        );
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('audio/')) {
          const ttsModel = response.headers['x-tts-model'] || 'gemini-tts';
          const ttsVoice = response.headers['x-tts-voice'] || 'Kore';
          setTelemetry((prev) => ({
            ...prev,
            tts: `Google Gemini TTS (${ttsModel} · ${ttsVoice})`,
          }));
          const blob = new Blob([response.data], { type: contentType });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioPlayerRef.current = audio;

          await new Promise((resolve) => {
            audio.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onerror = () => resolve();
            audio.play().catch(() => resolve());
          });

          if (statusRef.current !== CALL_STATES.INTERRUPTED) {
            resumeListeningIfActive(350);
          }
          return;
        }
      } catch (ttsErr) {
        let errMsg = 'Google Gemini TTS request failed.';
        try {
          if (ttsErr.response?.data) {
            const decoded = new TextDecoder().decode(ttsErr.response.data);
            errMsg = JSON.parse(decoded).message || errMsg;
          }
        } catch {}
        setErrorMessage(`${errMsg} Falling back to Browser SpeechSynthesis for playback.`);
        toast(errMsg, 'warning');
      }
    }

    setTelemetry((prev) => ({ ...prev, tts: 'Browser SpeechSynthesis' }));
    await speakWithBrowserSynthesis(text, detectedLang);

    if (statusRef.current !== CALL_STATES.INTERRUPTED) {
      resumeListeningIfActive(350);
    }
  };

  const sendCustomerTurn = async (text) => {
    const clean = text.trim();
    if (!clean || !callIdRef.current) {
      inFlightRef.current = false;
      return;
    }

    inFlightRef.current = true;
    setErrorMessage('');
    setRetryAction(null);
    setLiveTranscript('');
    updateStatus(CALL_STATES.THINKING);

    try {
      const { data } = await api.post(`/calls/${callIdRef.current}/turn`, {
        message: clean,
        language: languageRef.current,
      });

      setTelemetry((prev) => ({
        ...prev,
        llm: `Groq LLM (${data.modelUsed || groqModel})`,
        latencyMs: data.latencyMs || null,
        tokensUsed: data.tokensUsed || null,
      }));

      setAnalysis(data.analysis);
      if (data.lead) setLead(data.lead);
      if (data.retrievedSources) setRetrievedSources(data.retrievedSources);
      if (data.bookedAppointment) {
        setBookedAppointment(data.bookedAppointment);
        toast('AI booked an appointment into your calendar!', 'success');
      }

      setMessages((prev) => [
        ...prev,
        { role: 'user', content: clean, timestamp: new Date().toISOString() },
        {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toISOString(),
          retrievedSources: data.retrievedSources,
          aiMode: data.aiMode,
        },
      ]);

      inFlightRef.current = false;
      await speakResponse(data.reply, data.detectedLanguage);
    } catch (err) {
      inFlightRef.current = false;
      const msg = err.response?.data?.message || 'Groq AI request failed.';
      setErrorMessage(msg);
      updateStatus(CALL_STATES.ERROR);
      setRetryAction({ label: 'Retry AI Response', run: () => sendCustomerTurn(clean) });
      toast(msg, 'error');
    }
  };

  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = languageRef.current === 'hi' ? 'hi-IN' : 'en-US';

    recognition.onresult = (event) => {
      if (
        sttProviderRef.current !== 'webspeech' ||
        mutedRef.current ||
        statusRef.current === CALL_STATES.SPEAKING ||
        statusRef.current === CALL_STATES.THINKING
      ) {
        return;
      }

      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += `${transcript} `;
        else interim += transcript;
      }

      setLiveTranscript(interim);
      if (finalText.trim()) {
        sendCustomerTurn(finalText.trim());
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setMicPermission('denied');
        setErrorMessage('Microphone permission denied. You can still type messages below.');
      }
    };

    recognition.onend = () => {
      if (
        sttProviderRef.current === 'webspeech' &&
        callIdRef.current &&
        statusRef.current === CALL_STATES.LISTENING &&
        !mutedRef.current
      ) {
        try {
          recognition.start();
        } catch {}
      }
    };

    recognitionRef.current = recognition;
  };

  const startCall = async () => {
    setErrorMessage('');
    setRetryAction(null);
    updateStatus(CALL_STATES.CONNECTING);
    setElapsedSeconds(0);
    setMessages([]);
    setAnalysis(null);
    setLead(null);
    setBookedAppointment(null);
    setRetrievedSources([]);
    inFlightRef.current = false;
    lastSubmittedFingerprintRef.current = '';

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          streamRef.current = stream;
          setMicPermission('granted');

          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          const audioCtx = new AudioCtx();
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume().catch(() => {});
          }
          audioCtxRef.current = audioCtx;

          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;

          if (window.MediaRecorder) {
            recorderMimeRef.current = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
              ? 'audio/webm;codecs=opus'
              : 'audio/webm';
          }
        } catch {
          setMicPermission('denied');
          toast('Microphone unavailable — text conversation mode remains active.', 'warning');
        }
      }

      if (sttProviderRef.current === 'webspeech') {
        initSpeechRecognition();
      }
      startAudioMonitorLoop();

      const { data } = await api.post('/calls/start', { language: languageRef.current });
      setCallId(data.call._id);
      callIdRef.current = data.call._id;
      setMessages(data.call.transcript || []);

      await speakResponse(data.greeting, languageRef.current);
    } catch (err) {
      const msg = err.response?.data?.message || 'Unable to start voice session';
      setErrorMessage(msg);
      updateStatus(CALL_STATES.ERROR);
      toast(msg, 'error');
    }
  };

  const endCall = async () => {
    const activeId = callIdRef.current;
    updateStatus(CALL_STATES.ENDED);
    inFlightRef.current = false;
    callIdRef.current = null;
    stopAudioResources();

    if (activeId) {
      try {
        await api.post(`/calls/${activeId}/end`, { durationSeconds: elapsedSeconds });
        toast('Call ended & CRM records updated.', 'success');
      } catch (err) {
        toast(err.response?.data?.message || 'Failed to finalize call', 'error');
      }
    }
  };

  const interruptSpeaking = () => {
    updateStatus(CALL_STATES.INTERRUPTED);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    resumeListeningIfActive(150);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;

    if (next) {
      cancelActiveRecording();
      setMicTracksEnabled(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (statusRef.current === CALL_STATES.LISTENING || statusRef.current === CALL_STATES.RECORDING) {
        updateStatus(CALL_STATES.MUTED);
      }
    } else {
      if (statusRef.current !== CALL_STATES.SPEAKING) {
        setMicTracksEnabled(true);
        if (statusRef.current === CALL_STATES.MUTED) {
          updateStatus(CALL_STATES.LISTENING);
        }
      }
      if (
        sttProviderRef.current === 'webspeech' &&
        statusRef.current === CALL_STATES.LISTENING &&
        recognitionRef.current
      ) {
        try {
          recognitionRef.current.start();
        } catch {}
      }
    }
  };

  const toggleVoiceRecording = async () => {
    if (!streamRef.current || !window.MediaRecorder) {
      toast('Microphone stream unavailable for audio recording.', 'warning');
      return;
    }
    if (muted) {
      toast('Unmute your microphone before recording.', 'warning');
      return;
    }

    if (statusRef.current !== CALL_STATES.RECORDING) {
      if (statusRef.current === CALL_STATES.SPEAKING) {
        interruptSpeaking();
      }
      setMicTracksEnabled(true);
      startSegmentRecorder('manual');
    } else {
      // Promote any active VAD or manual segment to manual send so it transmits immediately
      recordingSourceRef.current = 'manual';
      setRecordingMode('manual');
      stopSegmentRecorder();
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim() || !callId) return;
    const text = manualInput;
    setManualInput('');
    sendCustomerTurn(text);
  };

  const isCallActive = ACTIVE_CALL_STATES.has(callStatus);
  const micActive =
    isCallActive &&
    micPermission === 'granted' &&
    !muted &&
    (callStatus === CALL_STATES.LISTENING || callStatus === CALL_STATES.RECORDING);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 pro-card flex flex-col overflow-hidden">
        {/* Console Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isCallActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              <Radio className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold">Voice Call Console</h2>
                <span className="rounded-md border border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  {callStatus}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Engine: {sttProvider === 'webspeech' ? 'Web Speech' : 'Groq Whisper'} + Groq LLM · TTS:{' '}
                {ttsProvider === 'gemini' ? 'Google Gemini TTS' : 'Browser SpeechSynthesis'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#131824] px-2.5 py-1.5 text-xs">
              <Languages className="h-3.5 w-3.5 text-indigo-500" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-label="Conversation Language"
                className="bg-transparent text-xs font-medium focus:outline-none"
              >
                <option value="auto">Auto (EN / HI)</option>
                <option value="en">English</option>
                <option value="hi">Hindi (हिन्दी)</option>
              </select>
            </div>

            {sttProvider === 'groq' && (
              <>
                <button
                  type="button"
                  onClick={() => setAutoListen((v) => !v)}
                  className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                    autoListen
                      ? 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#131824] text-slate-500'
                  }`}
                  title="Toggle automatic hands-free Voice Activity Detection"
                >
                  Auto VAD: {autoListen ? 'ON' : 'OFF'}
                </button>

                <select
                  value={silenceDurationMs}
                  onChange={(e) => setSilenceDurationMs(Number(e.target.value))}
                  aria-label="VAD Silence Threshold"
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#131824] px-2 py-1.5 text-[11px] font-medium focus:outline-none"
                  title="Silence duration before auto-sending speech"
                >
                  <option value={800}>800ms pause</option>
                  <option value={1000}>1000ms pause</option>
                  <option value={1200}>1200ms pause</option>
                </select>
              </>
            )}

            <span className="font-mono text-base font-bold tabular-nums text-slate-700 dark:text-slate-200 px-1">
              {formatTimer(elapsedSeconds)}
            </span>

            {isCallActive && (
              <button
                onClick={toggleMute}
                className={`rounded-xl p-2.5 border transition-colors cursor-pointer ${
                  muted
                    ? 'border-rose-500/40 bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={muted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}

            {!isCallActive ? (
              <button onClick={startCall} className="pro-btn-primary py-2">
                <PhoneCall className="h-4 w-4" />
                Start Call
              </button>
            ) : (
              <button
                onClick={endCall}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition-colors cursor-pointer"
              >
                <PhoneOff className="h-4 w-4" />
                End Call
              </button>
            )}
          </div>
        </div>

        {/* Waveform & Live States */}
        <div className="bg-[#0B0E16] border-b border-slate-800/80 px-6 py-5 flex flex-col items-center justify-center">
          <canvas ref={canvasRef} width={660} height={84} className="w-full max-w-xl h-20" />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-wider">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 border ${
                callStatus === CALL_STATES.RECORDING
                  ? 'border-rose-500/50 bg-rose-500/15 text-rose-300'
                  : micActive
                    ? 'border-sky-500/40 bg-sky-500/10 text-sky-400'
                    : muted && isCallActive
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                      : 'border-slate-800 bg-slate-900/60 text-slate-500'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  callStatus === CALL_STATES.RECORDING
                    ? 'bg-rose-400 animate-ping'
                    : micActive
                      ? 'bg-sky-400 animate-ping'
                      : muted && isCallActive
                        ? 'bg-rose-500'
                        : 'bg-slate-600'
                }`}
              />
              <Mic className="h-3.5 w-3.5" />
              {muted && isCallActive
                ? 'Muted'
                : callStatus === CALL_STATES.RECORDING
                  ? `Recording ${recordingMode === 'vad' ? '(Auto VAD)' : '(Manual)'} · ${micLevel}%`
                  : micActive
                    ? `Listening (${micLevel}%)`
                    : callStatus === CALL_STATES.SPEAKING
                      ? 'Mic Paused (AI Speaking)'
                      : 'Mic Standby'}
            </span>

            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 border ${
                callStatus === CALL_STATES.TRANSCRIBING
                  ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                  : callStatus === CALL_STATES.THINKING
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                    : callStatus === CALL_STATES.SPEAKING
                      ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
                      : callStatus === CALL_STATES.INTERRUPTED
                        ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                        : callStatus === CALL_STATES.ERROR
                          ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                          : 'border-slate-800 bg-slate-900/60 text-slate-500'
              }`}
            >
              <Volume2 className="h-3.5 w-3.5" />
              {callStatus === CALL_STATES.TRANSCRIBING
                ? 'Transcribing (Groq Whisper)...'
                : callStatus === CALL_STATES.THINKING
                  ? 'Thinking (Groq LLM + RAG)...'
                  : callStatus === CALL_STATES.SPEAKING
                    ? 'Speaking Response...'
                    : callStatus === CALL_STATES.INTERRUPTED
                      ? 'Interrupted'
                      : callStatus === CALL_STATES.ERROR
                        ? 'Error'
                        : 'AI Idle'}
            </span>

            {isCallActive && streamRef.current && sttProvider === 'groq' && (
              <button
                type="button"
                disabled={
                  callStatus === CALL_STATES.TRANSCRIBING || callStatus === CALL_STATES.THINKING
                }
                onClick={toggleVoiceRecording}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                  callStatus === CALL_STATES.RECORDING
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-sky-600 hover:bg-sky-500 text-white'
                }`}
              >
                {callStatus === CALL_STATES.RECORDING ? (
                  <>
                    <Square className="h-3 w-3" /> Stop &amp; Send Voice
                  </>
                ) : (
                  <>
                    <Mic className="h-3 w-3" /> Record Voice (Groq Whisper)
                  </>
                )}
              </button>
            )}

            {callStatus === CALL_STATES.SPEAKING && (
              <button
                type="button"
                onClick={interruptSpeaking}
                className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-[10px] font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                Stop Speaking (Interrupt)
              </button>
            )}
          </div>

          {sttProvider === 'webspeech' && !speechSupported && (
            <p className="mt-2 text-[11px] text-amber-400/90">
              Web Speech API is unavailable in this browser. Switch STT Provider to Groq Whisper in Settings or type below.
            </p>
          )}
        </div>

        {/* Missing Groq Key Banner */}
        {!hasGroqKey && (
          <div className="mx-6 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>GROQ_API_KEY Required:</strong> Add your free Groq API key to enable live Whisper STT &amp; Groq LLM responses.
              </span>
            </div>
            <Link
              to="/settings"
              className="rounded-lg bg-amber-600 px-3 py-1 font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              Configure Groq Key
            </Link>
          </div>
        )}

        {/* Active Pipeline Badges */}
        <div className="mx-6 mt-4 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#131824] px-2.5 py-1 text-slate-600 dark:text-slate-300">
            <strong>STT:</strong> {telemetry.stt}
          </span>
          <span className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#131824] px-2.5 py-1 text-slate-600 dark:text-slate-300">
            <strong>LLM:</strong> {telemetry.llm}
            {telemetry.latencyMs ? ` (${telemetry.latencyMs}ms · ${telemetry.tokensUsed} tok)` : ''}
          </span>
          <span className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#131824] px-2.5 py-1 text-slate-600 dark:text-slate-300">
            <strong>TTS:</strong> {telemetry.tts}
          </span>
        </div>

        {/* Error & Retry Banner */}
        {errorMessage && (
          <div className="mx-6 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            {retryAction && (
              <button
                type="button"
                onClick={retryAction.run}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1 font-semibold text-white hover:bg-rose-700 cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                {retryAction.label}
              </button>
            )}
          </div>
        )}

        {/* Transcript */}
        <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[420px] min-h-[280px]">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <Sparkles className="h-9 w-9 text-indigo-500/40 mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Ready for Hands-Free AI Voice Session
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-md">
                Click &ldquo;Start Call&rdquo; and speak naturally in English or Hindi. Auto VAD detects speech pauses and automatically sends segments to Groq Whisper &amp; Groq LLM.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-xs'
                      : 'bg-slate-100 dark:bg-[#151A26] border border-slate-200/70 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-xs'
                  }`}
                >
                  <p>{msg.content}</p>
                  {msg.retrievedSources?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap gap-1.5">
                      {msg.retrievedSources.map((s, sIdx) => (
                        <span
                          key={sIdx}
                          className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-[#0F131C] px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300"
                        >
                          <BookOpen className="h-2.5 w-2.5" />
                          {s.title} ({Math.round(s.score * 100)}%)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="mt-1 text-[10px] font-medium text-slate-400">
                  {msg.role === 'user' ? 'Prospect' : 'SalesPilot AI'}
                </span>
              </div>
            ))
          )}

          {liveTranscript && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl border border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2 text-sm italic text-indigo-700 dark:text-indigo-300">
                {liveTranscript}...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Text Input */}
        <form
          onSubmit={handleManualSubmit}
          className="border-t border-slate-200/80 dark:border-slate-800 p-4 bg-slate-50/70 dark:bg-[#0C0F17] flex items-center gap-3"
        >
          <input
            type="text"
            disabled={
              !isCallActive ||
              callStatus === CALL_STATES.THINKING ||
              callStatus === CALL_STATES.TRANSCRIBING
            }
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={
              isCallActive
                ? 'Speak hands-free or type an English / Hindi message...'
                : 'Start a call to speak or send messages...'
            }
            className="pro-input flex-1"
          />
          <button
            type="submit"
            disabled={
              !isCallActive ||
              !manualInput.trim() ||
              callStatus === CALL_STATES.THINKING ||
              callStatus === CALL_STATES.TRANSCRIBING
            }
            className="pro-btn-primary py-2.5"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </form>
      </div>

      {/* Live CRM Intelligence Panel */}
      <div className="space-y-5">
        <div className="pro-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="pro-label mb-0">Live Qualification</h3>
            {analysis?.leadStatus && <StatusBadge value={analysis.leadStatus} />}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-[#131824] p-3.5">
              <p className="text-[11px] text-slate-500">Lead Score</p>
              <p className="text-2xl font-extrabold tabular-nums text-indigo-600 dark:text-indigo-400">
                {analysis?.leadScore ?? '--'}
                <span className="text-xs font-normal text-slate-400">/100</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-[#131824] p-3.5">
              <p className="text-[11px] text-slate-500">Sentiment</p>
              <div className="mt-1.5">
                <StatusBadge value={analysis?.sentiment || 'neutral'} />
              </div>
            </div>
          </div>

          {lead && (
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-1.5 text-xs mb-4">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                <UserCheck className="h-4 w-4 text-emerald-500" />
                CRM Record Synced
              </div>
              <p><span className="text-slate-500">Name:</span> {lead.name}</p>
              {lead.company && <p><span className="text-slate-500">Company:</span> {lead.company}</p>}
              {lead.email && <p><span className="text-slate-500">Email:</span> {lead.email}</p>}
              {lead.budget && <p><span className="text-slate-500">Budget:</span> {lead.budget}</p>}
              {lead.timeline && <p><span className="text-slate-500">Timeline:</span> {lead.timeline}</p>}
            </div>
          )}

          {bookedAppointment && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs space-y-1 mb-4">
              <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                <CalendarCheck className="h-4 w-4" />
                Appointment Booked by AI
              </div>
              <p className="font-medium">{bookedAppointment.title}</p>
              <p className="text-emerald-600 dark:text-emerald-400">
                {new Date(bookedAppointment.scheduledAt).toLocaleString()}
              </p>
            </div>
          )}

          {analysis?.summary && (
            <div className="space-y-3 text-xs">
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">AI Summary</p>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{analysis.summary}</p>
              </div>
              {analysis.recommendedNextAction && (
                <div>
                  <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">Recommended Next Action</p>
                  <p className="text-indigo-600 dark:text-indigo-400 font-medium">
                    {analysis.recommendedNextAction}
                  </p>
                </div>
              )}
              {analysis.objections?.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">Detected Objections</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.objections.map((obj, idx) => (
                      <span
                        key={idx}
                        className="rounded-md border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 text-[11px] text-rose-700 dark:text-rose-300"
                      >
                        {obj}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pro-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-indigo-600" />
            <h3 className="pro-label mb-0">RAG Retrieved Context</h3>
          </div>
          {retrievedSources.length === 0 ? (
            <p className="text-xs text-slate-400">
              Relevant excerpts from your uploaded PDF/TXT knowledge base will appear here during the call.
            </p>
          ) : (
            <div className="space-y-2.5">
              {retrievedSources.map((src, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-[#131824] p-3 text-xs"
                >
                  <div className="flex items-center justify-between font-semibold mb-1">
                    <span className="truncate text-indigo-600 dark:text-indigo-400">{src.title}</span>
                    <span className="text-slate-400 tabular-nums">{Math.round(src.score * 100)}%</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 line-clamp-3">{src.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
