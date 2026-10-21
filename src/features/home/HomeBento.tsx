'use client';

import Link from 'next/link';
import { countLabel } from '@/content/plural';
import { ui } from '@/content/ui.ru';
import { Card, CardFooter, CardHeader } from '@/ui/Card';
import { CounterChip } from '@/ui/Chip';
import { IconButton } from '@/ui/IconButton';
import { IconArrowUpRight, IconChevronRight } from '@/ui/icons';
import { Notice } from '@/ui/Notice';
import { formatDate, formatTime, formatWeekday } from '@/ui/format';
import { Num } from '@/ui/Num';
import { useCan } from '../shell/StaffContext';
import { StartVisitForm } from './StartVisitForm';
import s from './home.module.css';

interface Props {
  today: string;
  recent: Array<{ patientId: string; card: string; name: string | null; date: string; boib: number | null }>;
  drafts: Array<{ id: string; card: string; name: string | null; updatedAt: string; docs: number }>;
  templates: number;
  personalTemplates: number;
  catalogUnverified: number;
}

export function HomeBento({ today, recent, drafts, templates, personalTemplates, catalogUnverified }: Props) {
  const canCatalog = useCan('catalog.manage');
  return (
    <div className={s.bento}>
      <Card tone="accent" className={s.start} padding={32}>
        <span className={s.startMeta}>{formatWeekday(today)}</span>
        <h1 className={s.startTitle}>
          {ui.home.startTitle} <span className={s.startRest}>{ui.home.startRest}</span>
        </h1>
        <StartVisitForm />
      </Card>

      <Card className={s.recent} padding={28}>
        <CardHeader
          title={ui.home.recent}
          meta={recent.length ? <CounterChip>{recent.length}</CounterChip> : undefined}
          action={
            <Link href="/patients" aria-label={ui.home.allPatients}>
              <IconButton label={ui.home.allPatients} icon={<IconArrowUpRight size={20} />} variant="muted" size={40} tabIndex={-1} />
            </Link>
          }
        />
        {recent.length ? (
          <ul className={s.list}>
            {recent.map((p) => (
              <li key={p.patientId}>
                <Link href={`/patients/${p.patientId}`} className={`${s.item} ${s.link}`}>
                  <span className={s.who}>
                    <span className={s.card}>{p.card}</span>
                    <span className={s.sub}>{p.name ?? 'Без имени'}</span>
                  </span>
                  <span className={s.sub}>
                    <Num>{formatDate(p.date)}</Num>
                  </span>
                  {p.boib !== null ? <CounterChip>BOIB {p.boib} %</CounterChip> : <span />}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.empty}>{ui.home.noPatients}</p>
        )}
      </Card>

      <Card className={s.drafts}>
        <CardHeader title={ui.home.drafts} meta={drafts.length ? <CounterChip>{drafts.length}</CounterChip> : undefined} />
        {drafts.length ? (
          <ul className={s.draftList}>
            {drafts.map((d) => (
              <li key={d.id}>
                <Link href={`/visits/${d.id}`} className={`${s.item} ${s.link}`}>
                  <span className={s.who}>
                    <span className={s.card}>{d.card}</span>
                    <span className={s.sub}>{countLabel(d.docs, ['документ', 'документа', 'документов'])}</span>
                  </span>
                  <span className={s.sub}>
                    <Num>{formatTime(d.updatedAt)}</Num>
                  </span>
                  <IconChevronRight size={18} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.empty}>{ui.home.draftsEmpty}</p>
        )}
      </Card>

      <div className={s.sideStack}>
      <Link href="/templates" className={s.link}>
        <Card interactive style={{ height: '100%' }}>
          <CardHeader title={ui.home.templates} action={<IconChevronRight size={20} />} />
          <CardFooter>
            <span className={s.big}>{templates}</span>
            <span className={s.sub}>{countLabel(personalTemplates, ['личный', 'личных', 'личных'])}</span>
          </CardFooter>
        </Card>
      </Link>

      <Card>
        <CardHeader
          title={ui.home.catalog}
          action={
            canCatalog ? (
              <Link href="/admin/catalog" aria-label={ui.home.catalog}>
                <IconChevronRight size={20} />
              </Link>
            ) : undefined
          }
        />
        <CardFooter>
          {catalogUnverified > 0 ? <Notice>{ui.catalog.notVerified}</Notice> : <span className={s.sub}>Все позиции проверены</span>}
        </CardFooter>
      </Card>
      </div>
    </div>
  );
}
