'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/ui/api';

/*
  Распознавание речи для диктовки карты. Два движка:
  server — звук с микрофона режется на фразы по паузам и отправляется на сервер клиники (/api/v1/dictation),
           сервер передаёт его в настроенный сервис распознавания (свой Whisper, Groq или OpenAI);
  browser — распознавание браузера (Web Speech API): Chrome отправляет звук в Google, Safari — в Apple.
  Если нет ни того ни другого, остаётся ввод текстом (на iPhone — диктовка клавиатуры).
*/

export type EngineMode = 'server' | 'browser' | 'none';

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => Recognition;

function browserCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// страница внутри чужой рамки (прототип в просмотре): рамка может запрещать микрофон независимо от настроек браузера
const framed = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

function micError(code: string) {
  if (code === 'not-allowed' || code === 'NotAllowedError' || code === 'service-not-allowed' || code === 'SecurityError') {
    return framed()
      ? 'В этом окне микрофон закрыт. Нажмите на поле ниже и диктуйте микрофоном клавиатуры.'
      : 'Нет доступа к микрофону. Разрешите его для этого сайта в настройках браузера.';
  }
  if (code === 'audio-capture' || code === 'NotFoundError') return 'Микрофон не найден.';
  if (code === 'network') return 'Распознавание речи недоступно без сети.';
  return 'Распознавание речи остановилось. Нажмите на микрофон ещё раз.';
}

const RECORDER_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
/** Пауза, после которой фраза считается законченной. */
const PHRASE_GAP_MS = 800;
/** Фраза длиннее режется принудительно. */
const MAX_PHRASE_MS = 12_000;
/** Пока тишина, запись перезапускается: в начало фразы попадает не больше этого времени тишины. */
const IDLE_RESTART_MS = 2_500;

export function useSpeech(onPhrase: (text: string) => void) {
  const [mode, setMode] = useState<EngineMode>('none');
  const [external, setExternal] = useState(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /** Микрофон недоступен на этой странице: остаётся ввод в поле (диктовка клавиатуры). */
  const [blocked, setBlocked] = useState(false);
  const level = useRef(0);
  const phrase = useRef(onPhrase);
  phrase.current = onPhrase;
  const stopRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let alive = true;
    api
      .get<{ engine: 'server' | null; private: boolean }>('/api/v1/dictation')
      .then((c) => {
        if (!alive) return;
        const recorder = typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
        if (c.engine === 'server' && recorder) {
          setMode('server');
          setExternal(!c.private);
        } else setMode(browserCtor() ? 'browser' : 'none');
      })
      .catch(() => alive && setMode(browserCtor() ? 'browser' : 'none'));
    return () => {
      alive = false;
    };
  }, []);

  const stop = useCallback(() => stopRef.current(), []);

  const startServer = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      const name = (e as Error).name;
      if (name === 'NotAllowedError' || name === 'SecurityError') setBlocked(framed());
      setError(micError(name));
      return;
    }
    const type = RECORDER_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
    const audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 1024;
    audio.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    let rec: MediaRecorder | null = null;
    let chunks: Blob[] = [];
    let startedAt = 0;
    let voiced = false;
    let voiceStart = 0;
    let lastVoice = 0;
    let floor = 0.01;
    let running = true;

    const send = async (blob: Blob) => {
      setPending((n) => n + 1);
      try {
        const form = new FormData();
        form.set('audio', blob);
        const res = await fetch('/api/v1/dictation', { method: 'POST', body: form, credentials: 'same-origin' });
        if (!res.ok) throw new Error(String(res.status));
        const { text } = (await res.json()) as { text: string };
        if (text) phrase.current(text);
      } catch {
        setError('Сервис распознавания не ответил. Фраза не записана, повторите её.');
      } finally {
        setPending((n) => n - 1);
      }
    };

    const begin = () => {
      chunks = [];
      rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start();
      startedAt = performance.now();
    };
    const cut = (keep: boolean) => {
      const r = rec;
      if (!r) return;
      const mine = chunks;
      r.onstop = () => {
        if (keep && mine.length) void send(new Blob(mine, { type: r.mimeType || type }));
      };
      r.stop();
      rec = null;
      if (running) begin();
    };

    begin();
    const timer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      // уровень шума подстраивается медленно вверх и быстро вниз; речь — заметно громче шума
      floor = rms < floor ? rms : floor * 1.002;
      const threshold = Math.max(0.012, floor * 3.2);
      level.current = Math.min(1, rms / (threshold * 2.5));
      const now = performance.now();
      if (rms > threshold) {
        if (!voiced) {
          voiced = true;
          voiceStart = now;
        }
        lastVoice = now;
      }
      if (voiced && (now - lastVoice > PHRASE_GAP_MS || now - startedAt > MAX_PHRASE_MS)) {
        // слишком короткий звук (щелчок, кашель) не отправляется
        cut(lastVoice - voiceStart > 250);
        voiced = false;
      } else if (!voiced && now - startedAt > IDLE_RESTART_MS) cut(false);
    }, 40);

    stopRef.current = () => {
      running = false;
      window.clearInterval(timer);
      if (voiced) cut(lastVoice - voiceStart > 250);
      else cut(false);
      stream.getTracks().forEach((t) => t.stop());
      void audio.close();
      level.current = 0;
      setListening(false);
      stopRef.current = () => undefined;
    };
    setListening(true);
  }, []);

  const startBrowser = useCallback(() => {
    const Ctor = browserCtor();
    if (!Ctor) return;
    const r = new Ctor();
    let wanted = true;
    r.lang = 'ru-RU';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const text = res[0].transcript.trim();
        if (res.isFinal) {
          if (text) phrase.current(text);
        } else live += `${text} `;
      }
      setInterim(live.trim());
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      wanted = false;
      setListening(false);
      setInterim('');
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setBlocked(framed());
      setError(micError(e.error));
    };
    // браузер останавливает распознавание после паузы: пока врач не выключил микрофон, оно перезапускается
    r.onend = () => {
      if (wanted) {
        try {
          r.start();
          return;
        } catch {
          /* перезапуск не удался */
        }
      }
      setListening(false);
      setInterim('');
    };
    stopRef.current = () => {
      wanted = false;
      r.stop();
      setListening(false);
      setInterim('');
      stopRef.current = () => undefined;
    };
    try {
      r.start();
      setListening(true);
    } catch {
      setError('Не удалось включить микрофон.');
    }
  }, []);

  const start = useCallback(() => {
    setError(null);
    if (mode === 'server') void startServer();
    else if (mode === 'browser') startBrowser();
  }, [mode, startServer, startBrowser]);

  useEffect(() => () => stopRef.current(), []);

  return { mode, external, listening, interim, pending, error, blocked, level, start, stop };
}
