'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* Распознавание речи средствами браузера (Web Speech API).
   Звук обрабатывает поставщик браузера: Chrome отправляет его на серверы Google, Safari — Apple или распознаёт на устройстве.
   Для рабочего режима без внешних сервисов движок заменяется своим сервером распознавания с тем же интерфейсом. */

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

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// страница внутри чужой рамки (например, прототип в просмотре): рамка может запрещать микрофон независимо от настроек браузера
const framed = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const ERRORS: Record<string, string> = {
  'not-allowed': 'Нет доступа к микрофону. Разрешите его в настройках браузера.',
  'service-not-allowed': 'Браузер не разрешает распознавание речи на этой странице.',
  'audio-capture': 'Микрофон не найден.',
  network: 'Распознавание речи недоступно без сети.',
};

export function useSpeech(onPhrase: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const phrase = useRef(onPhrase);
  phrase.current = onPhrase;

  useEffect(() => setSupported(ctor() !== null), []);

  const stop = useCallback(() => {
    wanted.current = false;
    rec.current?.stop();
    setListening(false);
    setInterim('');
  }, []);

  const start = useCallback(() => {
    const Ctor = ctor();
    if (!Ctor) return;
    setError(null);
    const r = new Ctor();
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
      wanted.current = false;
      setListening(false);
      setInterim('');
      setError(
        (e.error === 'not-allowed' || e.error === 'service-not-allowed') && framed()
          ? 'Здесь микрофон закрыт рамкой страницы, разрешение браузера не помогает. Нажмите на поле ниже и диктуйте кнопкой микрофона на клавиатуре.'
          : (ERRORS[e.error] ?? 'Распознавание речи остановилось. Попробуйте ещё раз.'),
      );
    };
    // Safari и Chrome останавливают распознавание после паузы: пока врач не выключил микрофон, оно перезапускается
    r.onend = () => {
      if (wanted.current) {
        try {
          r.start();
          return;
        } catch {
          /* перезапуск не удался — выключаемся */
        }
      }
      setListening(false);
      setInterim('');
    };
    rec.current = r;
    wanted.current = true;
    try {
      r.start();
      setListening(true);
    } catch {
      setError('Не удалось включить микрофон.');
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { supported, listening, interim, error, start, stop };
}
