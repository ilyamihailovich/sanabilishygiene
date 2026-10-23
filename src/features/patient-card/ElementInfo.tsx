import type { MapElement } from '@/domain/brushMap';
import { brushBrand } from '@/domain/brushes';
import type { IssueSnapshot } from '@/schemas/snapshot';
import s from './card.module.css';

/** Как вводить ёршик: из отметок врача в карте, словами для пациента. */
function howTo(el: MapElement): string {
  const d = el.data;
  if (d.method === 'BOTH') return 'Вводите ёршик с двух сторон: снаружи и изнутри.';
  const side = d.approach === 'ORAL' ? 'с внутренней стороны, от языка или нёба' : 'с внешней стороны, от щеки или губы';
  return `Вводите ёршик ${side}${d.method === 'ANGLED' ? ', под углом' : ''}.`;
}

/** Содержимое плашки промежутка на онлайн-карте пациента. */
export function ElementInfo({ element, snapshot }: { element: MapElement; snapshot: IssueSnapshot }) {
  const d = element.data;
  const size = d.size;
  const c = size && 'catalogId' in size ? snapshot.brushMap?.sizes[size.catalogId] : undefined;
  const dot = c?.colorHex ?? (size && 'freeText' in size ? size.color : undefined);
  const title = element.kind === 'edge' ? `Поверхность ${element.label}` : `Промежуток ${element.label}`;
  return (
    <div className={s.info}>
      <span className={s.infoTitle}>{title}</span>
      {size ? (
        <span className={s.infoSize}>
          <span className={s.infoDot} style={dot ? { background: dot } : undefined} data-free={dot ? undefined : 'true'} aria-hidden="true" />
          <span>
            <span className={s.infoLabel}>{c ? c.label : 'freeText' in size ? size.freeText : '—'}</span>
            {c && <span className={s.infoMeta}>{brushBrand(c)}</span>}
          </span>
        </span>
      ) : d.alternative === 'FLOSS' ? (
        <span className={s.infoLabel}>Здесь используйте зубную нить</span>
      ) : (
        <span className={s.infoLabel}>Ёршик здесь не нужен</span>
      )}
      {size && <span className={s.infoText}>{howTo(element)}</span>}
      {d.bleeding === true && <span className={s.infoNote}>При осмотре здесь была кровоточивость</span>}
    </div>
  );
}
