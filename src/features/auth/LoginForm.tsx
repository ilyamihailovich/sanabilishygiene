'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ui } from '@/content/ui.ru';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { ConcentricBackdrop } from '@/ui/ConcentricBackdrop';
import { TextField } from '@/ui/Field';
import { glassClass } from '@/ui/Glass';
import { Heading } from '@/ui/Heading';
import { IconArrowRight } from '@/ui/icons';
import { Logo } from '@/ui/Logo';
import { cx } from '@/ui/cx';
import s from './login.module.css';

export function LoginForm({ idle, next }: { idle: boolean; next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/v1/auth/login', { email, password });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ui.auth.invalid);
      setBusy(false);
    }
  };

  return (
    <div className={s.page}>
      <ConcentricBackdrop className={s.rings} rings={9} />
      <div className={cx(glassClass, s.card)}>
        <div className={s.brand}>
          <Logo height={15} />
          <Heading as="h1" level="title2" rest={ui.auth.subtitle}>
            {ui.auth.title}
          </Heading>
        </div>
        {idle && <p className={s.info}>{ui.auth.idle}</p>}
        <form className={s.form} onSubmit={submit}>
          <TextField label={ui.auth.email} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextField label={ui.auth.password} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
          <Button type="submit" size="lg" block disabled={busy} trailing={<IconArrowRight size={18} />}>
            {ui.auth.submit}
          </Button>
        </form>
      </div>
    </div>
  );
}
