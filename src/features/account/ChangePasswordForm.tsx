'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ui } from '@/content/ui.ru';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { TextField } from '@/ui/Field';
import { Heading } from '@/ui/Heading';
import s from './account.module.css';

export function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api.post('/api/v1/auth/password', { current, next });
      setDone(true);
      setCurrent('');
      setNext('');
      router.refresh();
    } catch (err) {
      setErrors(err instanceof ApiError ? (err.fields ?? { next: err.message }) : { next: 'Ошибка' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={s.card}>
      <form onSubmit={submit} className={s.form}>
        <Heading level="title3" as="h2">
          {ui.auth.changePassword}
        </Heading>
        {forced && <p className={s.muted}>{ui.auth.mustChange}</p>}
        <TextField label={ui.auth.currentPassword} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.current} required />
        <TextField label={ui.auth.newPassword} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} hint={ui.auth.passwordHint} error={errors.next} minLength={10} required />
        {done && <p role="status" className={s.muted}>{ui.auth.passwordChanged}</p>}
        <div>
          <Button type="submit" disabled={busy}>
            {ui.common.save}
          </Button>
        </div>
      </form>
    </Card>
  );
}
