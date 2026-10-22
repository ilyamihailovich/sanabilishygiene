import { useEffect, useState } from 'react';
import s0 from '@/features/account/account.module.css';
import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';
import { HotkeyOrder } from '@/features/account/HotkeyOrder';
import { LogoutAllCard } from '@/features/account/LogoutAllCard';
import { LoginForm } from '@/features/auth/LoginForm';
import { HomeBento } from '@/features/home/HomeBento';
import { PatientCardView } from '@/features/patient-card/PatientCardView';
import { PatientCard } from '@/features/patients/PatientCard';
import { PatientSearch } from '@/features/patients/PatientSearch';
import type { StaffInfo } from '@/features/shell/StaffContext';
import { StaffShell } from '@/features/shell/StaffShell';
import { TemplateEditor } from '@/features/templates/TemplateEditor';
import { TemplateLibrary } from '@/features/templates/TemplateLibrary';
import { VisitWorkspace, type VisitDoc } from '@/features/visit/VisitWorkspace';
import { ui } from '@/content/ui.ru';
import { emptyBrushMap } from '@/domain/brushMap';
import { carryOverBrushMap, fillFromTemplate } from '@/domain/documents';
import { emptyPsr } from '@/domain/psr';
import { brushMapSchema, type BrushMapContent } from '@/schemas/brushMap';
import type { IssueSnapshot } from '@/schemas/snapshot';
import type { TemplateStructure } from '@/schemas/template';
import type { CatalogItem } from '@/server/services/catalog';
import { Card } from '@/ui/Card';
import { Heading } from '@/ui/Heading';
import { Segmented } from '@/ui/Segmented';
import sample from '../prisma/sample-content.json';
import data from './data.json';
import { addDoc, removeDoc, seedDocs, useDocs } from './docStore';
import type { MockDocs } from './mockApi';
import { navigate, usePath } from './router';
import s from './demo.module.css';

declare global {
  interface Window {
    __DEMO_PDF_PAGES?: string[];
    __DEMO_PDF_PAGES_PUBLIC?: string[];
  }
}

type Tab = 'doctor' | 'patient' | 'pdf';
type DocType = VisitDoc['type'];

const snapshot = data.snapshot as unknown as IssueSnapshot;
const documents = data.documents as unknown as VisitDoc[];
const catalog = data.catalog as unknown as CatalogItem[];
const templates = data.templates as unknown as Array<{
  id: string;
  kind: 'HYGIENE_PLAN' | 'AFTERCARE';
  title: string;
  personal: boolean;
  archived: boolean;
  version: number;
  updatedAt: string;
  hasDraft: boolean;
  structure: TemplateStructure;
}>;

export const PATIENT_URL = 'https://hygiene.sanabilis.ru/p/Xq7mR2vKp9TzW4nL';
export const MAIN_VISIT = 'v-main';

const staff: StaffInfo = {
  id: 'u-doctor',
  displayName: sample.doctor.displayName,
  role: 'DOCTOR',
  roleLabel: 'Врач',
  permissions: ['patient.write', 'visit.write', 'visit.delete', 'document.write', 'issue.create', 'link.manage', 'template.personal', 'texts.approve'],
  prefs: { mapMode: 'three', sizeHotkeys: [] },
  idleTimeoutMin: 240,
};

/* Пациенты и визиты прототипа. Заполнен один визит: пациент 10482, остальные показывают список и пустой визит. */
export const patients = [
  { id: 'p-10482', cardNumber: sample.patient.cardNumber, displayName: sample.patient.displayName as string | null, fullName: sample.patient.fullName as string | null },
  { id: 'p-10391', cardNumber: '10391', displayName: 'Михаил', fullName: null },
  { id: 'p-10377', cardNumber: '10377', displayName: null, fullName: null },
  { id: 'p-10215', cardNumber: '10215', displayName: 'Елена', fullName: null },
  { id: 'p-10164', cardNumber: '10164', displayName: 'Дмитрий', fullName: null },
  { id: 'p-10102', cardNumber: '10102', displayName: 'Ольга', fullName: null },
];

interface DemoVisit {
  id: string;
  patientId: string;
  date: string;
  status: 'DRAFT' | 'ISSUED';
  documents: DocType[];
  boib: number | null;
  psr: number | null;
  psrStar: boolean;
}

const visits: DemoVisit[] = [
  { id: MAIN_VISIT, patientId: 'p-10482', date: snapshot.visitDate, status: 'ISSUED', documents: ['BRUSH_MAP', 'PSR', 'HYGIENE_PLAN', 'AFTERCARE'], boib: snapshot.brushMap?.boib.pct ?? null, psr: 2, psrStar: true },
  { id: 'v-10391', patientId: 'p-10391', date: '2026-10-21', status: 'DRAFT', documents: ['BRUSH_MAP'], boib: null, psr: null, psrStar: false },
  { id: 'v-10377', patientId: 'p-10377', date: '2026-10-20', status: 'ISSUED', documents: ['BRUSH_MAP', 'HYGIENE_PLAN'], boib: 18, psr: null, psrStar: false },
  { id: 'v-10215', patientId: 'p-10215', date: '2026-10-16', status: 'ISSUED', documents: ['BRUSH_MAP', 'PSR', 'HYGIENE_PLAN'], boib: 9, psr: 1, psrStar: false },
  { id: 'v-10164', patientId: 'p-10164', date: '2026-10-09', status: 'ISSUED', documents: ['BRUSH_MAP', 'PSR'], boib: 42, psr: 3, psrStar: false },
  { id: 'v-10102', patientId: 'p-10102', date: '2026-09-30', status: 'ISSUED', documents: ['BRUSH_MAP', 'AFTERCARE'], boib: 22, psr: null, psrStar: false },
  { id: 'v-10482-apr', patientId: 'p-10482', date: '2026-04-14', status: 'ISSUED', documents: ['BRUSH_MAP', 'PSR'], boib: 31, psr: 2, psrStar: false },
];

const visitsOf = (patientId: string) => visits.filter((v) => v.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date));
const doctors = [{ id: staff.id, displayName: staff.displayName, title: sample.doctor.title }];
const psrTexts = Object.entries(sample.psr).map(([code, t]) => ({ code, staffText: t.staff, approved: true }));
const templateRefs = templates.map((t) => ({ id: t.id, kind: t.kind, title: t.title, personal: t.personal }));

seedDocs(MAIN_VISIT, documents);
const mainMap = brushMapSchema.parse(documents.find((d) => d.type === 'BRUSH_MAP')!.content);

/** Создание и удаление документов в прототипе: те же функции, что на сервере, без базы. */
export const demoDocs: MockDocs = {
  create(visitId, { type, templateId, start }) {
    const id = `d-${Math.random().toString(36).slice(2, 10)}`;
    let content: unknown;
    let templateVersionId: string | null = null;
    if (type === 'BRUSH_MAP') {
      const base = emptyBrushMap();
      content =
        start?.from === 'previous'
          ? carryOverBrushMap(mainMap)
          : brushMapSchema.parse({ ...base, teeth: { ...base.teeth, ...(start?.teeth as BrushMapContent['teeth'] | undefined) } });
    } else if (type === 'PSR') content = emptyPsr();
    else {
      const t = templates.find((x) => x.id === templateId) ?? templates.find((x) => x.kind === (type === 'HYGIENE_PLAN' ? 'HYGIENE_PLAN' : 'AFTERCARE'))!;
      content = fillFromTemplate(t.id, t.version, t.title, t.structure);
      templateVersionId = `${t.id}-v${t.version}`;
    }
    addDoc(visitId, { id, type: type as DocType, rev: 1, content, templateVersionId });
    return { id };
  },
  remove: removeDoc,
};

const furcationTeeth = (() => {
  const map = documents.find((d) => d.type === 'BRUSH_MAP');
  if (!map) return [];
  return Object.entries(brushMapSchema.parse(map.content).teeth)
    .filter(([, t]) => t.furcation)
    .map(([k]) => Number(k));
})();

function Visit({ id }: { id: string }) {
  const main = id === MAIN_VISIT;
  const v = visits.find((x) => x.id === id);
  // Новый визит из карточки пациента: id вида v-new-<patientId>
  const patientId = v?.patientId ?? (id.startsWith('v-new-') ? id.slice(6) : 'p-10482');
  const p = patients.find((x) => x.id === patientId) ?? patients[0]!;
  const docs = useDocs(id);
  // прошлая карта есть только у пациента 10482: заполненный визит прототипа
  const previousMapDate = patientId === 'p-10482' && !main ? snapshot.visitDate : null;
  return (
    <VisitWorkspace
      key={id}
      step="map"
      staff={staff}
      visit={{
        id,
        date: v?.date ?? new Date().toISOString().slice(0, 10),
        clinicianId: staff.id,
        nextVisitDate: null,
        nextVisitMonths: main ? 6 : null,
        status: v?.status ?? 'DRAFT',
        patient: p,
      }}
      documents={docs}
      previousMapDate={previousMapDate}
      catalog={catalog}
      doctors={doctors}
      templates={templateRefs}
      psrTexts={psrTexts}
      blockers={[]}
      previousBoib={main ? { pct: 31, bleeding: 8, examined: 26, date: '2026-04-14' } : null}
      furcationTeeth={main ? furcationTeeth : []}
      share={main ? PATIENT_URL : null}
      lastIssue={main ? { id: 'demo', number: 1, issuedAt: snapshot.issuedAt } : null}
    />
  );
}

function StaffRoutes({ path }: { path: string }) {
  const [, section, id] = path.split('/');
  if (section === 'visits' && id) return <Visit id={id} />;
  if (section === 'patients' && id) {
    const p = patients.find((x) => x.id === id) ?? patients[0]!;
    return (
      <PatientCard
        key={p.id}
        patient={p}
        visits={visitsOf(p.id).map((v) => ({
          id: v.id,
          date: v.date,
          status: v.status,
          documents: v.documents,
          boib: v.boib,
          psr: v.psr,
          psrStar: v.psrStar,
          lastIssueId: v.status === 'ISSUED' ? `issue-${v.id}` : null,
        }))}
      />
    );
  }
  if (section === 'patients') {
    return (
      <PatientSearch
        initial={patients.map((p) => {
          const vs = visitsOf(p.id);
          return { ...p, lastVisit: vs[0]?.date ?? null, visits: vs.length };
        })}
      />
    );
  }
  if (section === 'templates' && id) {
    const t = templates.find((x) => x.id === id);
    if (t) return <TemplateEditor key={t.id} id={t.id} title={t.title} kind={t.kind} archived={false} library version={t.version} hasDraft={false} structure={t.structure} />;
  }
  if (section === 'templates') return <TemplateLibrary templates={templates} />;
  if (section === 'account') {
    return (
      <div className={s0.stack}>
        <Heading as="h1" level="title1" rest={staff.displayName}>
          {ui.nav.account}
        </Heading>
        <ChangePasswordForm />
        <HotkeyOrder items={catalog.map((c) => ({ id: c.id, label: c.label, colorHex: c.colorHex }))} initial={[]} />
        <LogoutAllCard />
      </div>
    );
  }
  if (section === 'admin') {
    return (
      <Card className={s.placeholder}>
        <Heading as="h1" level="title2">
          Администрирование
        </Heading>
        <p>Тексты, каталог, сотрудники и журнал в прототип не вошли. Они есть в приложении.</p>
      </Card>
    );
  }
  const recent = patients
    .map((p) => ({ p, v: visitsOf(p.id).find((x) => x.status === 'ISSUED') }))
    .filter((x) => x.v)
    .map(({ p, v }) => ({ patientId: p.id, card: p.cardNumber, name: p.displayName, date: v!.date, boib: v!.boib }));
  return (
    <HomeBento
      today={new Date().toISOString()}
      recent={recent}
      drafts={visits
        .filter((v) => v.status === 'DRAFT')
        .map((v) => {
          const p = patients.find((x) => x.id === v.patientId)!;
          return { id: v.id, card: p.cardNumber, name: p.displayName, updatedAt: `${v.date}T10:40:00.000Z`, docs: v.documents.length };
        })}
      templates={templates.length}
      personalTemplates={0}
      catalogUnverified={0}
    />
  );
}

/** Интерактивный прототип: рабочее место врача, онлайн-карта пациента и PDF на образце данных. */
export function DemoApp() {
  const [tab, setTab] = useState<Tab>('doctor');
  const [pdfKind, setPdfKind] = useState<'staff' | 'public'>('staff');
  const path = usePath();

  // Кнопки «PDF» и «Печать» в прототипе открывают вкладку со страницами PDF
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a');
      if (a && a.getAttribute('href')?.includes('/pdf')) {
        e.preventDefault();
        // «Скачать PDF» на онлайн-карте отдаёт вариант по ссылке, кнопки врача — вариант с ФИО
        setPdfKind(a.getAttribute('href')?.startsWith('#') ? 'public' : 'staff');
        setTab('pdf');
        window.scrollTo({ top: 0 });
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return (
    <>
      <div className={s.strip}>
        <div className={s.stripInner}>
          <span className={s.label}>
            Прототип <span className={s.muted}>без сервера, изменения не сохраняются</span>
          </span>
          <Segmented
            label="Экран прототипа"
            value={tab}
            onChange={(v) => {
              setTab(v);
              window.scrollTo({ top: 0 });
            }}
            options={[
              { value: 'doctor', label: 'Врач' },
              { value: 'patient', label: 'Пациент' },
              { value: 'pdf', label: 'PDF' },
            ]}
          />
        </div>
      </div>

      {tab === 'doctor' &&
        (path === '/login' ? (
          <LoginForm idle={false} next="/" />
        ) : (
          <StaffShell staff={staff}>
            <StaffRoutes path={path} />
          </StaffShell>
        ))}

      {tab === 'patient' && <PatientCardView snapshot={{ ...snapshot, patientFullName: undefined }} pdfUrl="#/pdf" />}

      {tab === 'pdf' && (
        <main className={s.pdf}>
          <div className={s.pdfHead}>
            <Segmented
              label="Вариант PDF"
              value={pdfKind}
              onChange={setPdfKind}
              options={[
                { value: 'staff', label: 'PDF врача' },
                { value: 'public', label: 'PDF по ссылке' },
              ]}
            />
            <span className={s.pdfNote}>
              {pdfKind === 'staff' ? 'Скачивает или печатает врач: в шапке полное ФИО.' : 'Скачивается с онлайн-карты по ссылке: только имя, без фамилии.'}
            </span>
          </div>
          {((pdfKind === 'public' ? window.__DEMO_PDF_PAGES_PUBLIC : window.__DEMO_PDF_PAGES) ?? []).map((src, i) => (
            <figure key={i} className={s.page}>
              <img src={src} alt={`PDF, страница ${i + 1}`} />
              <figcaption>Страница {i + 1}</figcaption>
            </figure>
          ))}
        </main>
      )}
    </>
  );
}

export { navigate };
