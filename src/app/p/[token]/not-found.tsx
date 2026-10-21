import { ui } from '@/content/ui.ru';
import s from '@/features/patient-card/card.module.css';
import { Heading } from '@/ui/Heading';
import { Mark } from '@/ui/Logo';
import { DEFAULT_SETTINGS } from '@/server/settings';

/** Отозванная или неизвестная ссылка: одинаковый ответ без объяснения причины. */
export default function InvalidLink() {
  const c = DEFAULT_SETTINGS.clinic;
  return (
    <main className={s.invalid}>
      <div className={s.invalidCard}>
        <Mark size={48} />
        <Heading as="h1" level="title2">
          {ui.patient.linkInvalid}
        </Heading>
        <p className={s.hint}>{ui.patient.linkInvalidText}</p>
        <address className={s.contacts} style={{ alignItems: 'center' }}>
          <span>{c.phone}</span>
          <span>{c.site}</span>
        </address>
      </div>
    </main>
  );
}
