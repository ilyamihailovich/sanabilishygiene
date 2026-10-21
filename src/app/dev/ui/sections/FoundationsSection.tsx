import { Heading } from '@/ui/Heading';
import { Section } from './Section';
import s from './foundations.module.css';

const swatches = [
  { name: 'Фон', token: '--color-bg', value: '#F5F5F7' },
  { name: 'Поверхность', token: '--color-surface', value: '#FFFFFF' },
  { name: 'Текст', token: '--color-text', value: '#1D1D1F' },
  { name: 'Текст вторичный', token: '--color-text-secondary', value: '#6E6E73 · AA' },
  { name: 'Текст крупный серый', token: '--color-text-tertiary', value: '#86868B · от 24 px' },
  { name: 'Акцент (временный)', token: '--accent', value: '#3A3A3C' },
  { name: 'Разделитель', token: '--color-separator', value: 'rgba(0,0,0,0.08)' },
  { name: 'Плашка', token: '--color-notice-bg', value: '#FBF4E6' },
];

const typeScale = [
  { level: 'display' as const, meta: '56 / 40 моб. · −0.025em', text: 'Карта ёршиков' },
  { level: 'title1' as const, meta: '44 / 34 моб.', text: 'Схема гигиены' },
  { level: 'title2' as const, meta: '32 / 28 моб.', text: 'Скрининг пародонта' },
  { level: 'title3' as const, meta: '24', text: 'Что понадобится' },
];

export function FoundationsSection() {
  return (
    <>
      <Section id="colors" title="Цвет." rest="Нейтральная схема до фирменных HEX." counter="8 токенов">
        <div className={s.swatches}>
          {swatches.map((sw) => (
            <div key={sw.token} className={s.swatch}>
              <div className={s.chip} style={{ background: `var(${sw.token})` }} />
              <span className={s.name}>{sw.name}</span>
              <span className={s.value}>{sw.value}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="type" title="Типографика." rest="Relative Pro, пока системный шрифт.">
        <div className={s.typeList}>
          {typeScale.map((t) => (
            <div key={t.level} className={s.typeRow}>
              <span className={s.typeMeta}>{t.meta}</span>
              <Heading as="p" level={t.level} rest={t.level === 'display' ? 'верхняя челюсть' : undefined}>
                {t.text}
              </Heading>
            </div>
          ))}
          <div className={s.typeRow}>
            <span className={s.typeMeta}>17 · текст</span>
            <p>
              Карта сохраняется автоматически. Любое изменение можно отменить кнопкой на панели инструментов или
              сочетанием клавиш.
            </p>
          </div>
          <div className={s.typeRow}>
            <span className={s.typeMeta}>15 · минимум</span>
            <p className={s.typeMeta}>Подписи, метаданные, служебные строки</p>
          </div>
          <div className={s.typeRow}>
            <span className={s.typeMeta}>Табличные цифры</span>
            <p className={s.numbers}>
              BOIB 18 % · 21.10.2026 · 14 из 26 · 111 / 888
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
