import { useEffect, useState } from 'react';
import type { StaffInfo } from '@/features/shell/StaffContext';
import { StaffShell } from '@/features/shell/StaffShell';
import { VisitWorkspace, type VisitDoc } from '@/features/visit/VisitWorkspace';
import { PatientCardView } from '@/features/patient-card/PatientCardView';
import { brushMapSchema } from '@/schemas/brushMap';
import type { IssueSnapshot } from '@/schemas/snapshot';
import type { CatalogItem } from '@/server/services/catalog';
import { Segmented } from '@/ui/Segmented';
import data from './data.json';
import s from './demo.module.css';

declare global {
  interface Window {
    __DEMO_PDF_PAGES?: string[];
  }
}

type Tab = 'doctor' | 'patient' | 'pdf';

const snapshot = data.snapshot as unknown as IssueSnapshot;
const documents = data.documents as unknown as VisitDoc[];
const catalog = data.catalog as unknown as CatalogItem[];
const PATIENT_URL = 'https://hygiene.sanabilis.ru/p/demo-prototip';

const staff: StaffInfo = {
  id: 'demo-doctor',
  displayName: 'Анна Сергеевна Иванова',
  role: 'DOCTOR',
  roleLabel: 'Врач',
  permissions: ['patient.write', 'visit.write', 'visit.delete', 'document.write', 'issue.create', 'link.manage', 'template.personal', 'texts.approve'],
  prefs: { mapMode: 'three', sizeHotkeys: [] },
  idleTimeoutMin: 240,
};

/** Интерактивный прототип: рабочее место врача, онлайн-карта пациента и PDF на демо-данных. */
export function DemoApp() {
  const [tab, setTab] = useState<Tab>('doctor');

  // Кнопки «PDF» и «Печать» в прототипе открывают вкладку со страницами PDF
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a');
      if (a && a.getAttribute('href')?.includes('/pdf')) {
        e.preventDefault();
        setTab('pdf');
        window.scrollTo({ top: 0 });
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  const map = documents.find((d) => d.type === 'BRUSH_MAP');
  const furcationTeeth = map
    ? Object.entries(brushMapSchema.parse(map.content).teeth)
        .filter(([, t]) => t.furcation)
        .map(([k]) => Number(k))
    : [];

  return (
    <>
      <div className={s.strip}>
        <div className={s.stripInner}>
          <span className={s.label}>
            Прототип <span className={s.muted}>на демо-данных, без сервера</span>
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

      {tab === 'doctor' && (
        <StaffShell staff={staff}>
          <VisitWorkspace
            step="map"
            staff={staff}
            visit={{
              id: 'demo-visit',
              date: snapshot.visitDate,
              clinicianId: 'demo-doctor',
              nextVisitDate: null,
              nextVisitMonths: 6,
              status: 'ISSUED',
              patient: { id: 'demo-patient', cardNumber: 'DEMO-001', displayName: 'Анна' },
            }}
            documents={documents}
            catalog={catalog}
            doctors={[{ id: 'demo-doctor', displayName: staff.displayName, title: 'врач-пародонтолог' }]}
            templates={[]}
            psrTexts={['0', '1', '2', '3', '4', '*'].map((code) => ({ code, staffText: `Демо-текст для сотрудника, код ${code}.`, approved: true }))}
            blockers={[]}
            previousBoib={{ pct: 31, bleeding: 8, examined: 26, date: '2026-04-14' }}
            furcationTeeth={furcationTeeth}
            share={PATIENT_URL}
            lastIssue={{ id: 'demo', number: 1, issuedAt: snapshot.issuedAt }}
          />
        </StaffShell>
      )}

      {tab === 'patient' && <PatientCardView snapshot={snapshot} pdfUrl="#/pdf" />}

      {tab === 'pdf' && (
        <main className={s.pdf}>
          {(window.__DEMO_PDF_PAGES ?? []).map((src, i) => (
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

export { PATIENT_URL };
