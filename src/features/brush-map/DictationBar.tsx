"use client";

import { useState } from "react";
import { cx } from "@/ui/cx";
import { glassClass } from "@/ui/Glass";
import { IconMic } from "@/ui/icons";
import { useSpeech } from "./useSpeech";
import s from "./dictation.module.css";

const NOTICE_KEY = "sanabilis.dictation.notice";

export interface PhraseOutcome {
  applied: string[];
  unknown: string[];
}

/**
 * Голосовой ввод: врач называет промежуток, производителя, размер и отметки, карта заполняется по ходу речи.
 * Если распознавание в браузере недоступно, фразу можно ввести текстом — разбор тот же.
 */
export function DictationBar({
  onPhrase,
  onClose,
}: {
  onPhrase: (text: string) => PhraseOutcome;
  onClose: () => void;
}) {
  const [log, setLog] = useState<
    Array<PhraseOutcome & { text: string; n: number }>
  >([]);
  const [typed, setTyped] = useState("");
  const [noticed, setNoticed] = useState(() => {
    try {
      return localStorage.getItem(NOTICE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const handle = (text: string) => {
    const outcome = onPhrase(text);
    setLog((l) =>
      [{ ...outcome, text, n: (l[0]?.n ?? 0) + 1 }, ...l].slice(0, 3),
    );
  };
  const speech = useSpeech(handle);

  const begin = () => {
    try {
      localStorage.setItem(NOTICE_KEY, "1");
    } catch {
      /* без хранилища уведомление покажется снова */
    }
    setNoticed(true);
    speech.start();
  };

  return (
    <div
      className={cx(glassClass, s.bar)}
      role="region"
      aria-label="Голосовой ввод"
    >
      <div className={s.head}>
        <span
          className={cx(s.status, speech.listening && s.live)}
          aria-hidden="true"
        >
          <IconMic size={18} />
        </span>
        <span className={s.title}>
          {speech.listening ? "Слушаю" : "Голосовой ввод"}
        </span>
        {speech.supported &&
          (speech.listening ? (
            <button type="button" className={s.action} onClick={speech.stop}>
              Пауза
            </button>
          ) : noticed ? (
            <button type="button" className={s.action} onClick={speech.start}>
              Говорить
            </button>
          ) : null)}
        <button
          type="button"
          className={s.close}
          aria-label="Закрыть голосовой ввод"
          onClick={() => {
            speech.stop();
            onClose();
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M2 2l6 6M8 2l-6 6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {speech.supported && !noticed && (
        <div className={s.notice}>
          <p>
            Речь распознаёт браузер: Chrome передаёт звук в Google, Safari — в
            Apple. Имя пациента не называйте.
          </p>
          <button type="button" className={s.primary} onClick={begin}>
            Включить микрофон
          </button>
        </div>
      )}

      {speech.listening && (
        <p className={s.hint}>
          {speech.interim ||
            "Например: «16 15, TePe 0,6, кровоточивость, дальше»"}
        </p>
      )}

      {speech.error && <p className={s.error}>{speech.error}</p>}

      {log.slice(0, 2).map((entry) => (
        <div key={entry.n} className={s.entry}>
          {entry.unknown.length > 0 && <span className={s.heard}>«{entry.text}»</span>}
          {entry.applied.length > 0 && (
            <span className={s.chips}>
              {entry.applied.map((a, i) => (
                <span key={i} className={s.chip}>
                  {a}
                </span>
              ))}
            </span>
          )}
          {entry.unknown.length > 0 && (
            <span className={s.unknown}>
              Не понял: {entry.unknown.join(", ")}
            </span>
          )}
        </div>
      ))}

      {/* ввод текстом всегда доступен: на iPhone в нём работает диктовка клавиатуры, она распознаёт речь на устройстве */}
      <form
        className={s.typed}
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) handle(typed.trim());
          setTyped("");
        }}
      >
        <input
          className={s.input}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="16 15 TePe 0,6 кровоточивость"
          aria-label="Фраза для голосового ввода"
        />
      </form>
    </div>
  );
}
