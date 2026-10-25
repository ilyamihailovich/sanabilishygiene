'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/ui/cx';
import { glassClass } from '@/ui/Glass';
import { IconMic } from '@/ui/icons';
import { useSpeech } from './useSpeech';
import s from './dictation.module.css';

const NOTICE_KEY = 'sanabilis.dictation.notice';

/** Запись ленты диктовки: промежуток (его текущие данные берутся из карты) или сообщение без промежутка. */
export interface DictationEntry {
  id: number;
  key: string | null;
  text: string;
  note?: string;
  unknown: string[];
}

export interface DictationRow extends DictationEntry {
  label?: string;
  color?: string | null;
  size?: string | null;
  brand?: string | null;
  bleeding?: boolean;
  floss?: boolean;
}

export interface PhraseOutcome {
  stop: boolean;
  unknown: string[];
}

interface Props {
  rows: DictationRow[];
  /** Промежуток под курсором: ему достанется следующий названный размер. */
  current: { label: string; value: string | null } | null;
  /** Производитель последнего продиктованного размера: следующий размер без названия производителя берётся у него. */
  brand: string | null;
  /** Открыта карточка промежутка: микрофон на паузе, панель скрыта. */
  paused: boolean;
  onPhrase: (text: string) => PhraseOutcome;
  onEdit: (key: string) => void;
  onClear: (key: string) => void;
  onClose: () => void;
  /** Прототип: сценарий фраз для показа без микрофона. */
  demo?: string[];
}

/**
 * Диктовка карты: врач называет промежуток, производителя и размер, карта заполняется по ходу речи,
 * курсор переходит к следующему промежутку. Каждая продиктованная запись — строка ленты: нажатие открывает её для правки.
 */
export function DictationPanel({ rows, current, brand, paused, onPhrase, onEdit, onClear, onClose, demo }: Props) {
  const [typed, setTyped] = useState('');
  const [sim, setSim] = useState<string | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const simRun = useRef(0);
  const [noticed, setNoticed] = useState(() => {
    try {
      return localStorage.getItem(NOTICE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const speechRef = useRef<ReturnType<typeof useSpeech> | null>(null);
  const handle = (text: string) => {
    const outcome = onPhrase(text);
    if (outcome.stop) speechRef.current?.stop();
  };
  const speech = useSpeech(handle);
  speechRef.current = speech;
  const ring = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const needsNotice = speech.external && speech.mode !== 'none' && !noticed;

  // уровень звука — кольцо вокруг кнопки микрофона
  useEffect(() => {
    if (!speech.listening) return;
    let raf = 0;
    const tick = () => {
      ring.current?.style.setProperty('--lvl', speech.level.current.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speech.listening, speech.level]);

  // карточка промежутка открыта — микрофон на паузе, после закрытия продолжает слушать
  const resume = useRef(false);
  useEffect(() => {
    if (paused && speech.listening) {
      resume.current = true;
      speech.stop();
    } else if (!paused && resume.current) {
      resume.current = false;
      speech.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const toggle = () => {
    if (speech.listening) return speech.stop();
    // микрофон закрыт страницей: кнопка открывает поле, где работает диктовка клавиатуры
    if (speech.blocked || speech.mode === 'none') return input.current?.focus();
    if (needsNotice) {
      try {
        localStorage.setItem(NOTICE_KEY, '1');
      } catch {
        /* без хранилища предупреждение покажется снова */
      }
      setNoticed(true);
    }
    speech.start();
  };

  const playDemo = async () => {
    if (!demo) return;
    const run = ++simRun.current;
    setDemoRunning(true);
    for (const phrase of demo) {
      const words = phrase.split(' ');
      for (let i = 1; i <= words.length; i++) {
        if (simRun.current !== run) return (setSim(null), setDemoRunning(false));
        setSim(words.slice(0, i).join(' '));
        await new Promise((r) => setTimeout(r, 260));
      }
      await new Promise((r) => setTimeout(r, 350));
      if (simRun.current !== run) return (setSim(null), setDemoRunning(false));
      setSim(null);
      handle(phrase);
      await new Promise((r) => setTimeout(r, 900));
    }
    if (simRun.current === run) setDemoRunning(false);
  };
  const simulating = demoRunning;

  const live = speech.listening || simulating;
  const status = speech.pending ? 'Заполняю…' : live ? 'Слушаю…' : 'Нажмите и говорите';

  const panel = (
    <div className={cx(glassClass, s.panel)} role="region" aria-label="Диктовка" hidden={paused}>
      <div className={s.head}>
        <button
          ref={ring}
          type="button"
          className={cx(s.mic, live && s.live)}
          aria-pressed={speech.listening}
          aria-label={speech.listening ? 'Остановить диктовку' : 'Начать диктовку'}
          onClick={toggle}
        >
          {live && (
            <>
              <span className={s.wave} aria-hidden="true" />
              <span className={cx(s.wave, s.wave2)} aria-hidden="true" />
            </>
          )}
          <IconMic size={24} />
        </button>
        <div className={s.headText}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={status}
              className={s.status}
              initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
              transition={{ duration: 0.22 }}
            >
              {status}
            </motion.span>
          </AnimatePresence>
          {current ? (
            <span className={s.current}>
              Сейчас <b>{current.label}</b>
              {current.value ? ` · ${current.value}` : brand ? ` · ${brand}, назовите размер` : ' · назовите марку и размер'}
            </span>
          ) : (
            <span className={s.current}>Например: «Curasept 16 15 0,6»</span>
          )}
        </div>
        <button type="button" className={s.close} aria-label="Закрыть диктовку" onClick={onClose}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>


      {(speech.interim || sim) && <p className={s.interim}>{speech.interim || sim}</p>}
      {needsNotice && !speech.listening && (
        <p className={s.notice}>
          {speech.mode === 'browser'
            ? 'Речь распознаёт браузер: Chrome передаёт звук в Google, Safari — в Apple.'
            : 'Звук передаётся во внешний сервис распознавания.'}{' '}
          Имя пациента не называйте.
        </p>
      )}
      {speech.error && <p className={s.error}>{speech.error}</p>}

      <ul className={s.feed} aria-label="Продиктовано" aria-live="polite">
        {rows.length === 0 && (
          <li className={s.empty}>
            Называйте подряд марку, промежуток и размер: «Curasept 16 15 0,6». Дальше можно только размеры — курсор сам идёт к следующему промежутку, марка
            запоминается. «Кровоточивость» — к последнему промежутку; «нить», «дальше», «отмена», «стоп».
            {demo && (
              <>
                {' '}
                <button type="button" className={s.link} onClick={playDemo}>
                  Показать пример
                </button>
              </>
            )}
          </li>
        )}
        {rows.map((r) =>
          r.key ? (
            <li key={r.id} className={s.rowWrap}>
              <button type="button" className={s.row} onClick={() => onEdit(r.key!)}>
                <span
                  className={s.dot}
                  style={r.color ? { background: r.color } : undefined}
                  data-kind={r.floss ? 'floss' : r.color ? undefined : 'empty'}
                  aria-hidden="true"
                />
                <span className={s.rowLabel}>{r.label}</span>
                <span className={s.rowValue}>
                  {r.floss ? 'зубная нить' : (r.size ?? 'без размера')}
                  {r.brand && !r.floss && <span className={s.rowBrand}>{r.brand}</span>}
                </span>
                {r.bleeding && (
                  <span className={s.drop} aria-label="кровоточивость">
                    <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
                      <path d="M5 0C6.6 2.3 9 4.9 9 7.4A4 4 0 0 1 1 7.4C1 4.9 3.4 2.3 5 0Z" fill="currentColor" />
                    </svg>
                  </span>
                )}
              </button>
              <button type="button" className={s.clear} aria-label={`Очистить ${r.label}`} onClick={() => onClear(r.key!)}>
                <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
                  <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              {r.unknown.length > 0 && <span className={s.unknown}>Не понял: {r.unknown.join(', ')}</span>}
            </li>
          ) : (
            <li key={r.id} className={s.message}>
              {r.note && <span>{r.note}</span>}
              {r.unknown.length > 0 && (
                <span className={s.unknown}>
                  Не понял «{r.text}»: {r.unknown.join(', ')}
                </span>
              )}
            </li>
          ),
        )}
      </ul>

      <form
        className={s.typed}
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) handle(typed.trim());
          setTyped('');
        }}
      >
        <input
          ref={input}
          className={s.input}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Curasept 16 15 0,6"
          aria-label="Фраза для диктовки"
          enterKeyHint="done"
        />
        {simulating ? (
          <button type="button" className={s.add} onClick={() => (simRun.current++, setSim(null), setDemoRunning(false))}>
            Стоп
          </button>
        ) : (
          <button type="submit" className={s.add} disabled={!typed.trim()}>
            Добавить
          </button>
        )}
      </form>
    </div>
  );

  return typeof document === 'undefined' ? null : createPortal(panel, document.body);
}
