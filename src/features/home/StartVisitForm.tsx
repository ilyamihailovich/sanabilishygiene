'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ui } from '@/content/ui.ru';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { TextField } from '@/ui/Field';
import { IconButton } from '@/ui/IconButton';
import { IconArrowRight } from '@/ui/icons';
import { useToast } from '@/ui/Toast';
import { useCan } from '../shell/StaffContext';
import s from './home.module.css';

interface Patient {
  id: string;
  cardNumber: string;
  displayName: string | null;
}

const normalize = (v: string) => v.trim().replace(/\s+/g, ' ').toUpperCase();

/** Начать визит по номеру медкарты: найти пациента или создать нового. */
export function StartVisitForm() {
  const router = useRouter();
  const toast = useToast();
  const canCreate = useCan('patient.write');
  const [card, setCard] = useState('');
  const [found, setFound] = useState<Patient | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const lookup = async (e: FormEvent) => {
    e.preventDefault();
    const value = normalize(card);
    if (!value) return;
    const list = await api.get<Patient[]>(`/api/v1/patients?card=${encodeURIComponent(value)}`);
    const exact = list.find((p) => p.cardNumber === value);
    if (exact) setFound(exact);
    else setCreating(true);
  };

  const startVisit = async (patientId: string, copyBrushMap: boolean) => {
    setBusy(true);
    try {
      const visit = await api.post<{ id: string }>(`/api/v1/patients/${patientId}/visits`, { copyBrushMap });
      router.push(`/visits/${visit.id}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const p = await api.post<Patient>('/api/v1/patients', { cardNumber: card, displayName: name });
      await startVisit(p.id, false);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
      setBusy(false);
    }
  };

  return (
    <>
      <form className={s.searchRow} onSubmit={lookup} role="search">
        <label htmlFor="start-card" className="visually-hidden">
          {ui.patients.cardNumber}
        </label>
        <input
          id="start-card"
          className={s.searchInput}
          placeholder={ui.home.cardPlaceholder}
          autoComplete="off"
          value={card}
          onChange={(e) => setCard(e.target.value)}
        />
        <IconButton label={ui.home.find} icon={<IconArrowRight size={20} />} size={52} type="submit" />
      </form>

      <Dialog
        open={found !== null}
        onClose={() => setFound(null)}
        title={found ? `Медкарта ${found.cardNumber}` : ''}
        actions={
          <>
            <Button variant="secondary" disabled={busy} onClick={() => found && startVisit(found.id, true)}>
              {ui.patients.copyMap}
            </Button>
            <Button disabled={busy} onClick={() => found && startVisit(found.id, false)}>
              {ui.patients.newVisit}
            </Button>
          </>
        }
      >
        <div className={s.found}>
          <span className={s.card}>{found?.displayName ?? 'Имя не указано'}</span>
          <a className={s.sub} href={found ? `/patients/${found.id}` : '#'}>
            Открыть карточку пациента
          </a>
        </div>
      </Dialog>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title={`${ui.patients.create} ${normalize(card)}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              {ui.common.cancel}
            </Button>
            <Button disabled={busy || !canCreate} onClick={create}>
              {ui.patients.newVisit}
            </Button>
          </>
        }
      >
        <div className={s.dialogBody}>
          <TextField label={ui.patients.displayName} hint={ui.patients.displayNameHint} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>
      </Dialog>
    </>
  );
}
