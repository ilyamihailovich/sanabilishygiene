'use client';

import { ui } from '@/content/ui.ru';
import { Heading } from '@/ui/Heading';
import { IconArrowRight } from '@/ui/icons';
import s from './templates.module.css';

interface Props {
  templates: Array<{ id: string; title: string; personal: boolean }>;
  disabled: boolean;
  compact?: boolean;
  onPick: (id: string) => void;
}

export function TemplatePicker({ templates, disabled, compact, onPick }: Props) {
  return (
    <div className={s.doc}>
      <Heading as="h3" level="title3" rest={compact ? 'ещё одна памятка' : undefined}>
        {ui.templates.choose}
      </Heading>
      {templates.length ? (
        <div className={s.picker}>
          {templates.map((t) => (
            <button key={t.id} type="button" className={s.pickCard} disabled={disabled} onClick={() => onPick(t.id)}>
              <span className={s.pickTitle}>{t.title}</span>
              <span className={s.pickFoot}>
                <span>{t.personal ? ui.templates.personal : ui.templates.library}</span>
                <IconArrowRight size={18} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className={s.kind}>{ui.templates.empty}</p>
      )}
    </div>
  );
}
