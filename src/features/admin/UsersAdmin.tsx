'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ui } from '@/content/ui.ru';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { CounterChip } from '@/ui/Chip';
import { Dialog } from '@/ui/Dialog';
import { Select, TextField } from '@/ui/Field';
import { Heading } from '@/ui/Heading';
import { IconPlus } from '@/ui/icons';
import { useToast } from '@/ui/Toast';
import s from './admin.module.css';

type Role = 'ADMIN' | 'DOCTOR' | 'HYGIENIST' | 'ASSISTANT';
interface User {
  id: string;
  email: string;
  displayName: string;
  title: string | null;
  role: Role;
  isActive: boolean;
}

const roles: Array<{ value: Role; label: string }> = [
  { value: 'DOCTOR', label: 'Врач' },
  { value: 'HYGIENIST', label: 'Гигиенист' },
  { value: 'ASSISTANT', label: 'Ассистент' },
  { value: 'ADMIN', label: 'Администратор' },
];
const roleLabel = (r: Role) => roles.find((x) => x.value === r)?.label ?? r;

export function UsersAdmin({ users, selfId }: { users: User[]; selfId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<(Partial<User> & { mode: 'create' | 'edit' }) | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const fail = (err: unknown) => toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');

  const submit = async () => {
    if (!form) return;
    try {
      if (form.mode === 'create') {
        const r = await api.post<{ password: string }>('/api/v1/admin/users', {
          email: form.email,
          displayName: form.displayName,
          title: form.title || null,
          role: form.role ?? 'DOCTOR',
        });
        setSecret(r.password);
      } else {
        await api.patch(`/api/v1/admin/users/${form.id}`, { displayName: form.displayName, title: form.title || null, role: form.role });
      }
      setForm(null);
      router.refresh();
    } catch (err) {
      fail(err);
    }
  };

  const reset = async (id: string) => {
    try {
      const r = await api.post<{ password: string }>(`/api/v1/admin/users/${id}/reset-password`);
      setSecret(r.password);
    } catch (err) {
      fail(err);
    }
  };

  const toggle = async (u: User) => {
    await api.patch(`/api/v1/admin/users/${u.id}`, { isActive: !u.isActive }).catch(fail);
    router.refresh();
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <Heading as="h1" level="title1" rest={ui.admin.title.toLowerCase()}>
          {ui.admin.users}
        </Heading>
        <Button leading={<IconPlus size={18} />} onClick={() => setForm({ mode: 'create', role: 'DOCTOR' })}>
          {ui.admin.newUser}
        </Button>
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Email</th>
              <th>{ui.admin.role}</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className={s.cellMain}>{u.displayName}</div>
                  <div className={s.muted}>{u.title}</div>
                </td>
                <td>{u.email}</td>
                <td>{roleLabel(u.role)}</td>
                <td>
                  <CounterChip>{u.isActive ? ui.admin.active : ui.admin.blocked}</CounterChip>
                </td>
                <td>
                  <div className={s.row} style={{ justifyContent: 'flex-end' }}>
                    <Button variant="ghost" size="sm" onClick={() => setForm({ mode: 'edit', ...u })}>
                      {ui.common.edit}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => reset(u.id)}>
                      {ui.admin.resetPassword}
                    </Button>
                    {u.id !== selfId && (
                      <Button variant="ghost" size="sm" onClick={() => toggle(u)}>
                        {u.isActive ? 'Заблокировать' : 'Разблокировать'}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.mode === 'create' ? ui.admin.newUser : ui.common.edit}
        actions={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>
              {ui.common.cancel}
            </Button>
            <Button onClick={submit}>{ui.common.save}</Button>
          </>
        }
      >
        {form && (
          <div className={s.form}>
            {form.mode === 'create' && <TextField label="Email" type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
            <TextField label={ui.admin.displayName} hint="Так врач будет указан в документе пациента" value={form.displayName ?? ''} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            <TextField label={ui.admin.jobTitle} value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select label={ui.admin.role} value={form.role ?? 'DOCTOR'} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} options={roles} disabled={form.id === selfId} />
          </div>
        )}
      </Dialog>

      <Dialog open={secret !== null} onClose={() => setSecret(null)} title={ui.admin.resetPassword} actions={<Button onClick={() => setSecret(null)}>Готово</Button>}>
        <div className={s.form}>
          <p className={s.muted}>{ui.admin.tempPassword}</p>
          <div className={s.secret}>{secret}</div>
        </div>
      </Dialog>
    </div>
  );
}
