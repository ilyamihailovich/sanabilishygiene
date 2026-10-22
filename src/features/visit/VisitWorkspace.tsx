'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ui } from '@/content/ui.ru';
import type { BoibResult } from '@/domain/brushMap';
import { patientTitle } from '@/domain/patient';
import { brushMapSchema } from '@/schemas/brushMap';
import { psrSchema } from '@/schemas/psr';
import { filledDocumentSchema } from '@/schemas/template';
import type { CatalogItem } from '@/server/services/catalog';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ConfirmDialog } from '@/ui/Dialog';
import { Heading, StepCounter } from '@/ui/Heading';
import { IconArrowRight, IconTrash } from '@/ui/icons';
import { spring } from '@/ui/motion';
import { useToast } from '@/ui/Toast';
import { formatDate } from '@/ui/format';
import { Num } from '@/ui/Num';
import { useMediaQuery } from '@/ui/hooks/useMediaQuery';
import { BrushMapEditor } from '../brush-map/BrushMapEditor';
import { BrushMapStart, type MapStartChoice } from '../brush-map/BrushMapStart';
import { IssuePanel } from '../issue/IssuePanel';
import { PsrEditor } from '../psr/PsrEditor';
import type { StaffInfo } from '../shell/StaffContext';
import { TemplateDocEditor } from '../templates/TemplateDocEditor';
import { TemplatePicker } from '../templates/TemplatePicker';
import s from './visit.module.css';

type StepKey = 'map' | 'psr' | 'plan' | 'aftercare' | 'issue';
const STEPS: StepKey[] = ['map', 'psr', 'plan', 'aftercare', 'issue'];

export interface VisitDoc {
  id: string;
  type: 'BRUSH_MAP' | 'PSR' | 'HYGIENE_PLAN' | 'AFTERCARE';
  rev: number;
  content: unknown;
  templateVersionId: string | null;
}

interface Props {
  step: string | null;
  staff: StaffInfo;
  visit: {
    id: string;
    date: string;
    clinicianId: string | null;
    nextVisitDate: string | null;
    nextVisitMonths: number | null;
    status: 'DRAFT' | 'ISSUED';
    patient: { id: string; cardNumber: string; displayName: string | null; fullName?: string | null };
  };
  documents: VisitDoc[];
  catalog: CatalogItem[];
  doctors: Array<{ id: string; displayName: string; title: string | null }>;
  templates: Array<{ id: string; kind: 'HYGIENE_PLAN' | 'AFTERCARE'; title: string; personal: boolean }>;
  psrTexts: Array<{ code: string; staffText: string; approved: boolean }>;
  blockers: string[];
  previousBoib: (BoibResult & { date: string }) | null;
  furcationTeeth: number[];
  /** Дата визита с прошлой картой ёршиков пациента: из неё можно начать новую. */
  previousMapDate?: string | null;
  share: string | null;
  lastIssue: { id: string; number: number; issuedAt: string } | null;
}

export function VisitWorkspace(props: Props) {
  const { visit, documents, staff } = props;
  const router = useRouter();
  const toast = useToast();
  const [step, setStepState] = useState<StepKey>(STEPS.includes(props.step as StepKey) ? (props.step as StepKey) : 'map');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canWrite = staff.permissions.includes('document.write');
  const compactMeta = useMediaQuery('(max-width: 720px)');
  const stepsRef = useRef<HTMLElement>(null);

  // Активная вкладка шага на телефоне прокручивается в центр полосы
  useEffect(() => {
    const nav = stepsRef.current;
    const el = nav?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    if (!nav || !el) return;
    nav.scrollTo({ left: el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
  }, [step]);

  const setStep = (next: StepKey) => {
    setStepState(next);
    router.replace(`/visits/${visit.id}?step=${next}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const docOf = (type: VisitDoc['type']) => documents.find((d) => d.type === type) ?? null;


  const patchVisit = async (patch: Record<string, unknown>) => {
    try {
      await api.patch(`/api/v1/visits/${visit.id}`, patch);
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
    }
  };

  const createDoc = async (type: VisitDoc['type'], templateId: string | null = null, start?: MapStartChoice) => {
    setBusy(true);
    try {
      await api.post(`/api/v1/visits/${visit.id}/documents`, { type, templateId, start });
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async (id: string) => {
    await api.del(`/api/v1/documents/${id}`).catch((e) => toast(e.message, 'error'));
    router.refresh();
  };

  const index = STEPS.indexOf(step);
  const next = STEPS[index + 1];
  const map = docOf('BRUSH_MAP');
  const psr = docOf('PSR');
  const plan = docOf('HYGIENE_PLAN');
  const aftercare = documents.filter((d) => d.type === 'AFTERCARE');
  const brushMapContent = map ? brushMapSchema.parse(map.content) : null;

  return (
    <div className={s.layout}>
      <div className={s.head}>
        <Heading as="h1" level="title1">
          <span className={s.card}>{visit.patient.cardNumber}</span> {patientTitle(visit.patient)}
        </Heading>
        <details className={s.metaDetails} open={!compactMeta}>
          <summary className={s.metaSummary}>
            <span>
              <Num>{formatDate(visit.date)}</Num> · {props.doctors.find((d) => d.id === visit.clinicianId)?.displayName ?? 'врач не указан'}
            </span>
          </summary>
        <div className={s.headMeta}>
          <label className={s.metaField}>
            <span className={s.metaLabel}>{ui.visit.date}</span>
            <input className={s.metaInput} type="date" defaultValue={visit.date} onChange={(e) => e.target.value && patchVisit({ date: e.target.value })} />
          </label>
          <label className={s.metaField}>
            <span className={s.metaLabel}>{ui.visit.clinician}</span>
            <select className={s.metaInput} value={visit.clinicianId ?? ''} onChange={(e) => patchVisit({ clinicianId: e.target.value || null })}>
              <option value="">{ui.common.notSet}</option>
              {props.doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                </option>
              ))}
            </select>
          </label>
          <div className={s.metaField}>
            <span className={s.metaLabel}>{ui.visit.nextVisit}</span>
            <div className={s.nextVisit}>
              <select
                className={s.metaInput}
                aria-label={ui.visit.nextVisitMonths}
                value={visit.nextVisitMonths ?? ''}
                onChange={(e) => patchVisit({ nextVisitMonths: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">через …</option>
                {[1, 2, 3, 4, 6, 9, 12].map((m) => (
                  <option key={m} value={m}>
                    через {m} мес.
                  </option>
                ))}
              </select>
              <input
                className={s.metaInput}
                type="date"
                aria-label={ui.visit.nextVisitDate}
                value={visit.nextVisitDate ?? ''}
                onChange={(e) => patchVisit({ nextVisitDate: e.target.value || null })}
              />
            </div>
          </div>
        </div>
        </details>
      </div>

      <div className={s.mobileStepsBar}>
        <nav ref={stepsRef} className={s.mobileSteps} aria-label="Шаги визита">
          {STEPS.map((k, i) => (
            <button key={k} type="button" data-step={k} className={s.mobileStep} aria-current={step === k ? 'step' : undefined} onClick={() => setStep(k)}>
              {step === k && <motion.span layoutId="mobile-step" className={s.mobileThumb} transition={spring} />}
              <span>
                {String(i + 1).padStart(2, '0')} {ui.visit.steps[i]}
              </span>
            </button>
          ))}
        </nav>
      </div>

      <ol className={s.steps} aria-label="Шаги визита">
        {STEPS.map((k, i) => (
          <li key={k}>
            <button type="button" className={s.step} aria-current={step === k ? 'step' : undefined} onClick={() => setStep(k)}>
              {step === k && <motion.span layoutId="visit-step" className={s.stepThumb} transition={spring} />}
              <span className={s.stepNum}>{String(i + 1).padStart(2, '0')}</span>
              <span className={s.stepLabel}>{ui.visit.steps[i]}</span>
            </button>
          </li>
        ))}
        {visit.status === 'DRAFT' && staff.permissions.includes('visit.delete') && (
          <li style={{ marginTop: 'var(--space-6)' }}>
            <Button variant="ghost" size="sm" leading={<IconTrash size={18} />} onClick={() => setConfirmDelete(true)}>
              {ui.visit.delete}
            </Button>
          </li>
        )}
      </ol>

      <section className={s.content} aria-label={ui.visit.steps[index]}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            className={s.stepBody}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className={s.stepHead}>
              <Heading as="h2" level="title2">
                {ui.visit.steps[index]}
              </Heading>
              <StepCounter current={index + 1} total={STEPS.length} />
            </div>

            {step === 'map' &&
              (map && brushMapContent ? (
                <BrushMapEditor
                  key={map.id}
                  documentId={map.id}
                  rev={map.rev}
                  initial={brushMapContent}
                  catalog={props.catalog}
                  hotkeyOrder={staff.prefs.sizeHotkeys}
                  initialMode={staff.prefs.mapMode}
                  previousBoib={props.previousBoib}
                />
              ) : (
                <BrushMapStart previousDate={props.previousMapDate ?? null} disabled={!canWrite || busy} onStart={(start) => createDoc('BRUSH_MAP', null, start)} />
              ))}

            {step === 'psr' &&
              (psr ? (
                <PsrEditor
                  key={psr.id}
                  documentId={psr.id}
                  rev={psr.rev}
                  initial={psrSchema.parse(psr.content)}
                  texts={props.psrTexts}
                  furcationTeeth={props.furcationTeeth}
                  onRemove={() => removeDoc(psr.id)}
                />
              ) : (
                <Card className={s.cta}>
                  <p className={s.ctaText}>Скрининг пародонта PSR: шесть секстантов, коды 0–4, отметка «*». Итог по наибольшему коду.</p>
                  <Button disabled={!canWrite || busy} onClick={() => createDoc('PSR')}>
                    Начать скрининг
                  </Button>
                </Card>
              ))}

            {step === 'plan' &&
              (plan ? (
                <TemplateDocEditor
                  key={plan.id}
                  documentId={plan.id}
                  rev={plan.rev}
                  initial={filledDocumentSchema.parse(plan.content)}
                  catalog={props.catalog}
                  brushMap={brushMapContent}
                  canSaveTemplate={staff.permissions.includes('template.personal')}
                  onRemove={() => removeDoc(plan.id)}
                />
              ) : (
                <TemplatePicker
                  templates={props.templates.filter((t) => t.kind === 'HYGIENE_PLAN')}
                  disabled={!canWrite || busy}
                  onPick={(id) => createDoc('HYGIENE_PLAN', id)}
                />
              ))}

            {step === 'aftercare' && (
              <>
                {aftercare.map((d) => (
                  <TemplateDocEditor
                    key={d.id}
                    documentId={d.id}
                    rev={d.rev}
                    initial={filledDocumentSchema.parse(d.content)}
                    catalog={props.catalog}
                    brushMap={brushMapContent}
                    canSaveTemplate={staff.permissions.includes('template.personal')}
                    onRemove={() => removeDoc(d.id)}
                  />
                ))}
                <TemplatePicker
                  templates={props.templates.filter((t) => t.kind === 'AFTERCARE')}
                  disabled={!canWrite || busy}
                  compact={aftercare.length > 0}
                  onPick={(id) => createDoc('AFTERCARE', id)}
                />
              </>
            )}

            {step === 'issue' && (
              <IssuePanel
                visitId={visit.id}
                blockers={props.blockers}
                share={props.share}
                lastIssue={props.lastIssue}
                canIssue={staff.permissions.includes('issue.create')}
                canManageLink={staff.permissions.includes('link.manage')}
                hasDocuments={documents.length > 0}
              />
            )}

            {next && (
              <div className={s.footer}>
                <Button variant="ghost" onClick={() => setStep(next)}>
                  {ui.visit.skip}
                </Button>
                <Button variant="secondary" trailing={<IconArrowRight size={18} />} onClick={() => setStep(next)}>
                  {ui.visit.steps[index + 1]}
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        title={ui.visit.deleteConfirm}
        confirmLabel={ui.common.delete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await api.del(`/api/v1/visits/${visit.id}`).catch((e) => toast(e.message, 'error'));
          router.replace(`/patients/${visit.patient.id}`);
        }}
      />
    </div>
  );
}
