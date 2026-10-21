import { countLabel } from '@/content/plural';
import { ui } from '@/content/ui.ru';
import { listElements, summarizeSizes } from '@/domain/brushMap';
import type { IssueSnapshot } from '@/schemas/snapshot';
import type { FilledDocument, FilledItem } from '@/schemas/template';
import { StepIllustration } from './Illustrations';
import { dateLong, nextVisitText, productLine } from './format';
import s from './card.module.css';

export interface BrushRow {
  ref: string;
  label: string;
  meta: string;
  color: string | null;
  count: number;
  where: string[];
}

/** «Ваши ёршики»: размеры, количество, где применять. Свободный ввод — текстом, без цвета. */
export function brushRows(snapshot: IssueSnapshot): BrushRow[] {
  const map = snapshot.brushMap;
  if (!map) return [];
  const labels = new Map(listElements(map.content).map((e) => [e.key, e.label]));
  return summarizeSizes(map.content).map((u) => {
    const c = u.catalogId ? map.sizes[u.catalogId] : undefined;
    return {
      ref: u.ref,
      label: c ? c.label : (u.freeText ?? '—'),
      meta: c ? `${c.brand}${c.line ? `, ${c.line}` : ''} · проход ${c.passageMm.replace('.', ',')} мм` : ui.map.freeText,
      color: c?.colorHex ?? null,
      count: u.count,
      where: u.keys.map((k) => labels.get(k) ?? k),
    };
  });
}

export function alternatives(snapshot: IssueSnapshot) {
  if (!snapshot.brushMap) return { floss: [] as string[], none: [] as string[] };
  const els = listElements(snapshot.brushMap.content).filter((e) => e.active);
  return {
    floss: els.filter((e) => e.data.alternative === 'FLOSS').map((e) => e.label),
    none: els.filter((e) => e.data.alternative === 'NONE').map((e) => e.label),
  };
}

export function BrushList({ rows, active, onPick, compact }: { rows: BrushRow[]; active?: string | null; onPick?: (ref: string) => void; compact?: boolean }) {
  return (
    <ul className={`${s.brushList} ${compact ? s.brushCompact : ''}`}>
      {rows.map((r) => {
        const body = (
          <>
            <span className={s.brushDot} style={r.color ? { background: r.color } : undefined} data-free={r.color ? undefined : 'true'} aria-hidden="true" />
            <span className={s.brushText}>
              <span className={s.brushLabel}>{r.label}</span>
              <span className={s.brushMeta}>{r.meta}</span>
              <span className={s.brushWhere}>
                {ui.patient.whereToUse}: {r.where.join(', ')}
              </span>
            </span>
            <span className={s.brushCount}>{countLabel(r.count, ui.map.interspaces)}</span>
          </>
        );
        return (
          <li key={r.ref}>
            {onPick ? (
              <button type="button" className={s.brushRow} aria-pressed={active === r.ref} onClick={() => onPick(r.ref)}>
                {body}
              </button>
            ) : (
              <div className={s.brushRow}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function AlternativesNote({ snapshot }: { snapshot: IssueSnapshot }) {
  const alt = alternatives(snapshot);
  if (!alt.floss.length && !alt.none.length) return null;
  return (
    <div className={s.note}>
      {alt.floss.length > 0 && (
        <p>
          {ui.patient.floss}: {alt.floss.join(', ')}
        </p>
      )}
      {alt.none.length > 0 && (
        <p>
          {ui.patient.notNeeded}: {alt.none.join(', ')}
        </p>
      )}
    </div>
  );
}

export function HowTo({ steps, compact }: { steps: string[]; compact?: boolean }) {
  return (
    <ol className={`${s.steps} ${compact ? s.stepsCompact : ''}`}>
      {steps.map((text, i) => (
        <li key={i} className={s.step}>
          <span className={s.stepArt}>
            <StepIllustration step={i} />
          </span>
          <span className={s.stepNum}>{String(i + 1).padStart(2, '0')}</span>
          <p>{text}</p>
        </li>
      ))}
    </ol>
  );
}

function Item({ item, brushes, sectionTitle }: { item: FilledItem; brushes: BrushRow[]; sectionTitle: string }) {
  switch (item.type) {
    case 'text':
      return <p className={s.paragraph}>{item.text}</p>;
    case 'warning':
      return (
        <div className={s.warning}>
          {/* заголовок, совпадающий с названием раздела, не повторяется */}
          {item.title.trim() !== sectionTitle.trim() && <p className={s.warningTitle}>{item.title}</p>}
          <p>{item.text}</p>
        </div>
      );
    case 'product': {
      const line = productLine(item);
      return (
        <div className={s.product}>
          <span className={s.productName}>{item.name}</span>
          {line && <span className={s.productLine}>{line}</span>}
        </div>
      );
    }
    case 'choice': {
      const chosen = item.options.filter((o) => item.selected.includes(o.id));
      return (
        <div>
          {item.prompt && <p className={s.paragraph}>{item.prompt}</p>}
          <ul className={s.bullets}>
            {chosen.map((o) => (
              <li key={o.id}>{o.label}</li>
            ))}
          </ul>
        </div>
      );
    }
    case 'input':
      return item.value ? (
        <p className={s.paragraph}>
          {item.label}: <strong>{item.inputKind === 'date' ? dateLong(item.value) : item.value}</strong>
          {item.suffix ? ` ${item.suffix}` : ''}
        </p>
      ) : null;
    case 'brushes':
      // в документе — краткая сводка, подробности в блоке «Ваши ёршики»
      return brushes.length ? (
        <ul className={s.brushChips}>
          {brushes.map((b) => (
            <li key={b.ref} className={s.brushChip}>
              <span className={s.brushChipDot} style={b.color ? { background: b.color } : undefined} data-free={b.color ? undefined : 'true'} aria-hidden="true" />
              {b.label} · {countLabel(b.count, ui.map.interspaces)}
            </li>
          ))}
        </ul>
      ) : null;
  }
}

export function DocumentBody({ doc, brushes }: { doc: FilledDocument; brushes: BrushRow[] }) {
  return (
    <div className={s.docBody}>
      {doc.sections.map((section) => (
        <section key={section.id} className={s.docSection}>
          <h3 className={s.docSectionTitle}>{section.title}</h3>
          {section.items.map((item) => (
            <Item key={item.id} item={item} brushes={brushes} sectionTitle={section.title} />
          ))}
        </section>
      ))}
    </div>
  );
}

export function Screening({ snapshot }: { snapshot: IssueSnapshot }) {
  const psr = snapshot.psr;
  if (!psr || psr.summary.maxCode === null) return null;
  return (
    <div className={s.screening}>
      <div className={s.bigValue}>
        <span>
          {psr.summary.maxCode}
          {psr.summary.asterisk ? '*' : ''}
        </span>
        <span className={s.bigMeta}>итоговый код PSR</span>
      </div>
      {psr.patientText && <p className={s.paragraph}>{psr.patientText}</p>}
      {psr.asteriskText && <p className={s.paragraph}>{psr.asteriskText}</p>}
    </div>
  );
}

export function Bleeding({ snapshot }: { snapshot: IssueSnapshot }) {
  const map = snapshot.brushMap;
  if (!map || map.boib.pct === null) return null;
  const prev = map.previousBoib;
  return (
    <div className={s.screening}>
      <div className={s.bigValue}>
        <span>{map.boib.pct} %</span>
        <span className={s.bigMeta}>
          {map.boib.bleeding} из {map.boib.examined}
          {prev && (
            <>
              <br />
              {dateLong(prev.date)}: {prev.pct} %
            </>
          )}
        </span>
      </div>
      {map.boibText && <p className={s.paragraph}>{map.boibText}</p>}
    </div>
  );
}

export function NextVisit({ snapshot }: { snapshot: IssueSnapshot }) {
  const text = nextVisitText(snapshot);
  if (!text) return null;
  return <p className={s.nextVisit}>{text}</p>;
}

export function Contacts({ snapshot }: { snapshot: IssueSnapshot }) {
  const c = snapshot.clinic;
  return (
    <address className={s.contacts}>
      <span>{c.address}</span>
      <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>{c.phone}</a>
      <a href={`https://${c.site}`}>{c.site}</a>
    </address>
  );
}
