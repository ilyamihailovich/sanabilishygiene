'use client';

import { useEffect, useState } from 'react';
import { ui } from '@/content/ui.ru';
import { api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Select } from '@/ui/Field';
import { Heading } from '@/ui/Heading';
import { formatDateTime } from '@/ui/format';
import { Num } from '@/ui/Num';
import s from './admin.module.css';

interface Row {
  id: string;
  at: string;
  user: string;
  action: string;
  actionLabel: string;
  entityType: string;
  entityId: string;
}
interface Page {
  rows: Row[];
  next: string | null;
}

const entityLabels: Record<string, string> = {
  user: 'Сотрудник',
  patient: 'Пациент',
  visit: 'Визит',
  document: 'Документ',
  template: 'Шаблон',
  brush: 'Каталог',
  psr_text: 'Текст PSR',
  boib_grade: 'Оценка BOIB',
  settings: 'Настройки',
};

export function AuditLogView({ initial, users, actions }: { initial: Page; users: Array<{ id: string; displayName: string }>; actions: Array<{ value: string; label: string }> }) {
  const [user, setUser] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(initial);
  const [first, setFirst] = useState(true);

  const query = (before?: string) => {
    const p = new URLSearchParams();
    if (user) p.set('user', user);
    if (action) p.set('action', action);
    if (before) p.set('before', before);
    return api.get<Page>(`/api/v1/admin/audit?${p}`);
  };

  useEffect(() => {
    if (first) {
      setFirst(false);
      return;
    }
    query().then(setPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, action]);

  return (
    <div className={s.page}>
      <Heading as="h1" level="title1" rest="кто, когда, что">
        {ui.admin.audit}
      </Heading>
      <div className={s.grid2} style={{ maxWidth: 640 }}>
        <Select label={ui.admin.who} value={user} onChange={(e) => setUser(e.target.value)} options={[{ value: '', label: 'Все' }, ...users.map((u) => ({ value: u.id, label: u.displayName }))]} />
        <Select label={ui.admin.action} value={action} onChange={(e) => setAction(e.target.value)} options={[{ value: '', label: 'Все' }, ...actions]} />
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>{ui.admin.when}</th>
              <th>{ui.admin.who}</th>
              <th>{ui.admin.action}</th>
              <th>{ui.admin.object}</th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Num>{formatDateTime(r.at)}</Num>
                </td>
                <td>{r.user}</td>
                <td className={s.cellMain} style={{ fontSize: 'var(--fs-caption)' }}>
                  {r.actionLabel}
                </td>
                <td>
                  {r.entityType === 'visit' ? (
                    <a href={`/visits/${r.entityId}`}>{entityLabels[r.entityType]}</a>
                  ) : r.entityType === 'patient' ? (
                    <a href={`/patients/${r.entityId}`}>{entityLabels[r.entityType]}</a>
                  ) : (
                    (entityLabels[r.entityType] ?? r.entityType)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {page.next && (
        <div>
          <Button variant="secondary" onClick={async () => {
            const more = await query(page.next!);
            setPage({ rows: [...page.rows, ...more.rows], next: more.next });
          }}>
            Показать ещё
          </Button>
        </div>
      )}
    </div>
  );
}
