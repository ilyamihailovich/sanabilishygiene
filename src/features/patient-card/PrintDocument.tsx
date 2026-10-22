import { ui } from '@/content/ui.ru';
import type { IssueSnapshot } from '@/schemas/snapshot';
import { Logo } from '@/ui/Logo';
import { boibTone, psrTone, toneStyle } from '@/ui/tone';
import { PrintScheme } from './PrintScheme';
import { AlternativesNote, Bleeding, BrushList, DocumentBody, HowTo, NextVisit, Screening, brushRows } from './blocks';
import { dateLong } from './format';
import card from './card.module.css';
import s from './print.module.css';

interface Props {
  snapshot: IssueSnapshot;
  qrSvg: string | null;
  renders: Partial<Record<'upper' | 'lower' | 'front', string>>;
}

const BENTO_BASE = '#f5f5f7';

/** Печатная версия A4: та же структура блоков, белый фон, размеры подписаны текстом для ч/б печати. */
export function PrintDocument({ snapshot, qrSvg, renders }: Props) {
  const map = snapshot.brushMap;
  const rows = brushRows(snapshot);
  const hasRenders = Boolean(renders.upper && renders.lower);

  return (
    <article className={`${s.doc} ${card.print}`}>
      <header className={s.head}>
        <div>
          <div className={s.brand}>
            <Logo height={13} />
          </div>
          <h1 className={s.title}>
            Рекомендации <span className={s.titleRest}>по гигиене полости рта</span>
          </h1>
          <div className={s.meta}>
            {(snapshot.patientFullName ?? snapshot.patientName) && <span className={s.patient}>{snapshot.patientFullName ?? snapshot.patientName}</span>}
            <span>
              {ui.patient.visitDate}: {dateLong(snapshot.visitDate)}
            </span>
            {snapshot.clinician && (
              <span>
                {ui.patient.doctor}: {snapshot.clinician.name}
                {snapshot.clinician.title ? `, ${snapshot.clinician.title}` : ''}
              </span>
            )}
          </div>
        </div>
        {qrSvg && (
          <div className={s.qr}>
            <span dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <span>{ui.patient.onlineCard}</span>
          </div>
        )}
      </header>

      {map && (
        <section className={s.block}>
          <h2 className={s.blockTitle}>{ui.patient.brushMap}</h2>
          {hasRenders ? (
            <div className={s.maps}>
              <figure className={s.mapFig}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={renders.upper} alt={ui.map.upper} />
                <figcaption>{ui.map.upper}</figcaption>
              </figure>
              <figure className={s.mapFig}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={renders.lower} alt={ui.map.lower} />
                <figcaption>{ui.map.lower}</figcaption>
              </figure>
            </div>
          ) : (
            <div className={s.maps}>
              {(['upper', 'lower'] as const).map((arch) => (
                <figure key={arch} className={s.mapFig}>
                  <PrintScheme snapshot={snapshot} arch={arch} />
                  <figcaption>{arch === 'upper' ? ui.map.upper : ui.map.lower}</figcaption>
                </figure>
              ))}
            </div>
          )}
          <p className={s.legendNote}>Правая сторона на рисунке слева. Размер ёршика подписан у каждого промежутка.</p>
        </section>
      )}

      {rows.length > 0 && (
        <section className={s.block}>
          <h2 className={s.blockTitle}>{ui.patient.yourBrushes}</h2>
          <BrushList rows={rows} compact />
          <AlternativesNote snapshot={snapshot} />
        </section>
      )}

      {snapshot.brushSteps && map && (
        <section className={s.block}>
          <h2 className={s.blockTitle}>{ui.patient.howTo}</h2>
          <HowTo steps={snapshot.brushSteps} compact />
        </section>
      )}

      {snapshot.hygienePlan && (
        <section className={s.block}>
          <h2 className={s.blockTitle}>{snapshot.hygienePlan.title}</h2>
          <DocumentBody doc={snapshot.hygienePlan} brushes={rows} />
        </section>
      )}

      {snapshot.aftercare.map((doc, i) => (
        <section key={i} className={s.block}>
          <h2 className={s.blockTitle}>{doc.title}</h2>
          <DocumentBody doc={doc} brushes={rows} />
        </section>
      ))}

      <div className={s.cols}>
        {snapshot.psr && snapshot.psr.summary.maxCode !== null && (
          <section className={`${s.block} ${s.bento}`} style={toneStyle(psrTone(snapshot.psr.summary.maxCode), BENTO_BASE)}>
            <h2 className={s.blockTitle}>{ui.patient.screening}</h2>
            <Screening snapshot={snapshot} />
          </section>
        )}
        {map && map.boib.pct !== null && (
          <section className={`${s.block} ${s.bento}`} style={toneStyle(boibTone(map.boib.pct), BENTO_BASE)}>
            <h2 className={s.blockTitle}>{ui.patient.bleeding}</h2>
            <Bleeding snapshot={snapshot} />
          </section>
        )}
      </div>

      {(snapshot.nextVisit.date || snapshot.nextVisit.months) && (
        <section className={s.block}>
          <h2 className={s.blockTitle}>{ui.patient.nextVisit}</h2>
          <NextVisit snapshot={snapshot} />
        </section>
      )}
    </article>
  );
}
