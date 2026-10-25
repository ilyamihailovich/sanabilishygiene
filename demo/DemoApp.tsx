import { useEffect, useState } from 'react';
import s0 from '@/features/account/account.module.css';
import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';
import { HotkeyOrder } from '@/features/account/HotkeyOrder';
import { LogoutAllCard } from '@/features/account/LogoutAllCard';
import { ProfileCard } from '@/features/account/ProfileCard';
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
import { patientTitle } from '@/domain/patient';
import { carryOverBrushMap, fillFromTemplate } from '@/domain/documents';
import { emptyPsr } from '@/domain/psr';
import { CatalogAdmin } from '@/features/admin/CatalogAdmin';
import { ALL_TEETH, emptyPerio, summarizePerio } from '@/domain/perio';
import { visitMetrics, type VisitMetrics } from '@/domain/history';
import { brushBrand, byBrandOrder, summarizeBrands } from '@/domain/brushes';
import { PatientReport } from '@/features/patients/PatientReport';
import type { PerioContent } from '@/schemas/perio';
import { brushMapSchema, type BrushMapContent } from '@/schemas/brushMap';
import type { IssueSnapshot } from '@/schemas/snapshot';
import type { TemplateStructure } from '@/schemas/template';
import type { CatalogItem } from '@/server/services/catalog';
import { Card } from '@/ui/Card';
import { Heading } from '@/ui/Heading';
import { Segmented } from '@/ui/Segmented';
import avatar from './assets/avatar-doctor.jpg';
import sample from '../prisma/sample-content.json';
import data from './data.json';
import { addDoc, getDocs, removeDoc, seedDocs, useDocs } from './docStore';
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
  // каталог в прототипе можно править, чтобы показать его целиком; в приложении это право выдаёт администратор
  permissions: ['patient.write', 'visit.write', 'visit.delete', 'document.write', 'issue.create', 'link.manage', 'template.personal', 'texts.approve', 'catalog.manage'],
  prefs: { mapMode: 'three', sizeHotkeys: [], avatar: null, avatarRev: 0 },
  idleTimeoutMin: 240,
  avatarUrl: avatar,
};

/* Пациенты и визиты прототипа. Заполнен один визит: пациент 10482, остальные показывают список и пустой визит. */
export const patients = [
  { id: 'p-10482', cardNumber: sample.patient.cardNumber, displayName: sample.patient.displayName as string | null, fullName: sample.patient.fullName as string | null },
  { id: 'p-10391', cardNumber: '10391', displayName: 'Михаил', fullName: 'Соколов Михаил Андреевич' },
  { id: 'p-10377', cardNumber: '10377', displayName: 'Наталья', fullName: 'Белова Наталья Игоревна' },
  { id: 'p-10215', cardNumber: '10215', displayName: 'Елена', fullName: 'Кузнецова Елена Викторовна' },
  { id: 'p-10164', cardNumber: '10164', displayName: 'Дмитрий', fullName: 'Морозов Дмитрий Олегович' },
  { id: 'p-10102', cardNumber: '10102', displayName: 'Ольга', fullName: 'Павлова Ольга Сергеевна' },
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
  { id: 'v-10482-apr', patientId: 'p-10482', date: '2026-04-14', status: 'ISSUED', documents: ['BRUSH_MAP', 'PSR', 'PERIO_CHART'], boib: 31, psr: 2, psrStar: false },
  { id: 'v-10482-oct', patientId: 'p-10482', date: '2025-10-08', status: 'ISSUED', documents: ['BRUSH_MAP', 'PSR', 'PERIO_CHART'], boib: 46, psr: 3, psrStar: true },
];

const visitsOf = (patientId: string) => visits.filter((v) => v.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date));
const doctors = [{ id: staff.id, displayName: staff.displayName, title: sample.doctor.title }];
const psrTexts = Object.entries(sample.psr).map(([code, t]) => ({ code, staffText: t.staff, approved: true }));
const templateRefs = templates.map((t) => ({ id: t.id, kind: t.kind, title: t.title, personal: t.personal }));

seedDocs(MAIN_VISIT, documents);
const mainMap = brushMapSchema.parse(documents.find((d) => d.type === 'BRUSH_MAP')!.content);

/**
 * Пародонтограмма прототипа: формула из карты ёршиков и заполненные для показа значения
 * (глубина 2–3 мм, карманы у моляров, рецессии у нижних резцов). Значения условные, не данные пациента.
 */
function demoPerio(): PerioContent {
  const pick = (state: string) => Object.entries(mainMap.teeth).filter(([, v]) => v.state === state).map(([k]) => Number(k));
  const c = emptyPerio({ missing: pick('MISSING'), implants: pick('IMPLANT') });
  for (const t of ALL_TEETH) {
    const tooth = c.teeth[String(t)]!;
    if (tooth.missing) continue;
    const n = t % 10;
    const molar = n >= 6;
    const lowerFront = t >= 31 && t <= 43 && n <= 3;
    for (let i = 0; i < 6; i++) {
      const interprox = i !== 1 && i !== 4;
      const seed = (t * 7 + Math.floor(t / 10) * 3 + i * 13) % 10;
      let pd = 2 + (interprox ? 1 : 0) + (seed > 7 ? 1 : 0);
      if (molar && interprox) pd += seed > 4 ? 2 : 1;
      if (t === 16 && i === 0) pd = 7;
      tooth.pd[i] = pd;
      tooth.gm[i] = lowerFront && i === 1 ? -2 : molar && seed > 6 ? -1 : 0;
      tooth.bop[i] = pd >= 4 && seed % 2 === 0;
      tooth.plaque[i] = seed % 3 === 0;
    }
  }
  c.teeth['16']!.furcation = { b: 1, mo: 2, do: 1 };
  c.teeth['46']!.furcation = { b: 2, o: 1 };
  c.teeth['31']!.mobility = 1;
  c.teeth['16']!.note = 'Обнажение фуркации, контроль через 3 месяца';
  return c;
}

/**
 * Документы прошлых визитов прототипа: открываются из ленты визитов заполненными, как их оставил врач.
 * Карта — образец визита, коды скрининга — из истории, пародонтограмма — образец, тексты — из шаблонов.
 */
function historyDocs(v: DemoVisit): VisitDoc[] {
  return v.documents.map((type, i) => {
    let content: unknown;
    let templateVersionId: string | null = null;
    if (type === 'BRUSH_MAP') content = mainMap;
    else if (type === 'PSR') {
      const c = emptyPsr();
      const code = v.psr ?? 0;
      const codes = { S1: code, S2: Math.max(0, code - 1), S3: code, S4: code, S5: Math.max(0, code - 2), S6: Math.max(0, code - 1) };
      for (const [k, value] of Object.entries(codes)) c.sextants[k as keyof typeof c.sextants] = { code: value as never, asterisk: v.psrStar && k === 'S1' };
      content = c;
    } else if (type === 'PERIO_CHART') content = demoPerio();
    else {
      const t = templates.find((x) => x.kind === (type === 'HYGIENE_PLAN' ? 'HYGIENE_PLAN' : 'AFTERCARE'))!;
      content = fillFromTemplate(t.id, t.version, t.title, t.structure);
      templateVersionId = `${t.id}-v${t.version}`;
    }
    return { id: `d-${v.id}-${i}`, type, rev: 1, content, templateVersionId };
  });
}

for (const v of visits) if (v.id !== MAIN_VISIT) seedDocs(v.id, historyDocs(v));
// у визита образца в ленте есть пародонтограмма: она же открывается из визита
if (!documents.some((d) => d.type === 'PERIO_CHART')) addDoc(MAIN_VISIT, { id: 'd-main-perio', type: 'PERIO_CHART', rev: 1, content: demoPerio(), templateVersionId: null });

const catalogRef = (id: string) => {
  const c = catalog.find((x) => x.id === id);
  return c ? { label: c.label, brand: brushBrand(c), color: c.colorHex } : null;
};

/**
 * История пациента для карточки в прототипе. Текущий визит считается из его документов,
 * прошлые — условные значения для показа динамики (воспаление и карманы постепенно уменьшаются).
 */
function demoHistory(patientId: string): VisitMetrics[] {
  return visitsOf(patientId).map((v, i, all) => {
    const base = { id: v.id, date: v.date, status: v.status, lastIssueId: v.status === 'ISSUED' ? `issue-${v.id}` : null };
    if (v.id === MAIN_VISIT) {
      const docs = getDocs(MAIN_VISIT);
      const m = visitMetrics(base, docs.map((d) => ({ type: d.type, content: d.content })), catalogRef);
      return { ...m, perio: m.perio ?? summarizePerio(demoPerio()), documents: m.documents.includes('PERIO_CHART') ? m.documents : [...m.documents, 'PERIO_CHART'] };
    }
    // чем старше визит, тем хуже показатели: i — сколько визитов новее этого
    const current = summarizePerio(demoPerio());
    const k = 1 + 0.16 * i;
    const age = i;
    const perio = v.documents.includes('PERIO_CHART')
      ? {
          ...current,
          meanPd: Math.round(current.meanPd * k * 10) / 10,
          meanAl: Math.round(current.meanAl * (1 + (k - 1) / 3) * 10) / 10,
          bopPct: Math.min(100, Math.round(current.bopPct * k * 1.6)),
          plaquePct: Math.min(100, Math.round(current.plaquePct * k * 1.3)),
          pd4: Math.round(current.pd4 * k * 1.2),
          pd5: Math.round(current.pd5 * k * 1.4),
          pd6: Math.round(current.pd6 * k * 1.5),
        }
      : null;
    const mainBrushes = visitMetrics(base, [{ type: 'BRUSH_MAP', content: mainMap }], catalogRef).brushes;
    return {
      ...base,
      documents: v.documents,
      boib: v.boib === null ? null : { pct: v.boib, bleeding: Math.round((v.boib * 26) / 100), examined: 26 },
      psr:
        v.psr === null
          ? null
          : { max: v.psr, star: v.psrStar, sextants: { S1: v.psr, S2: Math.max(0, v.psr - 1), S3: v.psr, S4: v.psr, S5: Math.max(0, v.psr - 2), S6: Math.max(0, v.psr - 1) } as never },
      perio,
      brushes: v.documents.includes('BRUSH_MAP') ? (mainBrushes ?? []).slice(0, Math.max(1, (mainBrushes?.length ?? 1) - age + 1)) : null,
      teeth: visitMetrics(base, [{ type: 'BRUSH_MAP', content: mainMap }], catalogRef).teeth,
    };
  });
}

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
    else if (type === 'PERIO_CHART') content = demoPerio();
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

function Visit({ id, step }: { id: string; step: string | null }) {
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
      step={step}
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

function StaffRoutes({ path: full }: { path: string }) {
  const [path = '/', query = ''] = full.split('?');
  const [, section, id] = path.split('/');
  if (section === 'visits' && id) return <Visit id={id} step={new URLSearchParams(query).get('step')} />;
  if (section === 'patients' && id) {
    const p = patients.find((x) => x.id === id) ?? patients[0]!;
    return (
      <PatientCard
        key={p.id}
        patient={p}
        history={demoHistory(p.id)}
        clinicians={Object.fromEntries(visitsOf(p.id).map((v) => [v.id, staff.displayName]))}
        nextVisit={p.id === 'p-10482' ? snapshot.nextVisit?.date ?? null : null}
        reportUrl={`#/report/${p.id}`}
      />
    );
  }
  if (section === 'report' && id) {
    const p = patients.find((x) => x.id === id) ?? patients[0]!;
    return (
      <div style={{ background: '#fff', borderRadius: 24 }}>
        <PatientReport
          patient={p}
          history={demoHistory(p.id)}
          clinicians={Object.fromEntries(visitsOf(p.id).map((v) => [v.id, staff.displayName]))}
          generatedAt={new Date().toISOString().slice(0, 10)}
        />
      </div>
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
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const recentVisits = visits.filter((v) => v.date >= since);
    return (
      <div className={s0.page}>
        <Heading as="h1" level="title1">
          {ui.nav.account}
        </Heading>
        <ProfileCard
          name={staff.displayName}
          title={sample.doctor.title}
          email="voronova@sanabilis.ru"
          roleLabel={staff.roleLabel}
          avatarUrl={staff.avatarUrl ?? null}
          stats={{
            visits30: recentVisits.length,
            issued30: recentVisits.filter((v) => v.status === 'ISSUED').length,
            patients: new Set(visits.map((v) => v.patientId)).size,
            personalTemplates: templates.filter((t) => t.personal).length,
          }}
        />
        <div className={s0.columns}>
          <section className={s0.section}>
            <HotkeyOrder items={byBrandOrder(catalog).map((c) => ({ id: c.id, label: c.label, colorHex: c.colorHex, brand: brushBrand(c) }))} initial={[]} />
          </section>
          <section className={s0.section}>
            <h2 className={s0.sectionTitle}>Безопасность</h2>
            <ChangePasswordForm />
            <LogoutAllCard />
          </section>
        </div>
      </div>
    );
  }
  if (section === 'admin' && id === 'catalog') return <CatalogAdmin items={catalog} brand={new URLSearchParams(query).get('brand')} />;
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
    .map(({ p, v }) => ({ patientId: p.id, card: p.cardNumber, name: patientTitle(p), date: v!.date, boib: v!.boib }));
  return (
    <HomeBento
      today={new Date().toISOString()}
      recent={recent}
      drafts={visits
        .filter((v) => v.status === 'DRAFT')
        .map((v) => {
          const p = patients.find((x) => x.id === v.patientId)!;
          return { id: v.id, card: p.cardNumber, name: patientTitle(p), updatedAt: `${v.date}T10:40:00.000Z`, docs: v.documents.length };
        })}
      templates={templates.length}
      personalTemplates={0}
      catalogUnverified={0}
      catalogBrands={summarizeBrands(catalog)}
    />
  );
}

/** Интерактивный прототип: рабочее место врача, онлайн-карта пациента и PDF на образце данных. */
export function DemoApp() {
  const [tab, setTab] = useState<Tab>('doctor');
  const [pdfKind, setPdfKind] = useState<'staff' | 'public'>('staff');
  const [notice, setNotice] = useState<string | null>(null);
  const path = usePath();

  // Кнопки «PDF» и «Печать» в прототипе открывают вкладку со страницами PDF
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a');
      if (a && a.getAttribute('href')?.endsWith('.ics')) {
        // просмотрщик прототипа блокирует скачивание файлов; в приложении телефон откроет «Добавить в Календарь»
        e.preventDefault();
        setNotice('В приложении здесь откроется «Добавить в Календарь». В прототипе скачивание файлов заблокировано.');
        setTimeout(() => setNotice(null), 4000);
        return;
      }
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

      {tab === 'patient' && <PatientCardView snapshot={{ ...snapshot, patientFullName: undefined }} pdfUrl="#/pdf" calendarUrl="#visit.ics" />}
      {notice && (
        <div className={s.notice} role="status">
          {notice}
        </div>
      )}

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
