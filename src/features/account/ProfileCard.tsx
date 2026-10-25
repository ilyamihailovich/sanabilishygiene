'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { useToast } from '@/ui/Toast';
import s from './account.module.css';

export interface ProfileStats {
  visits30: number;
  issued30: number;
  patients: number;
  personalTemplates: number;
}

interface Props {
  name: string;
  title: string | null;
  email: string;
  roleLabel: string;
  avatarUrl: string | null;
  stats: ProfileStats;
}

/** Событие для шапки: фото сменилось, показать новое без перезагрузки страницы. */
export const AVATAR_EVENT = 'sanabilis:avatar';

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** Профиль врача: фото (можно сменить или убрать), подпись в документах и статистика работы. */
export function ProfileCard({ name, title, email, roleLabel, avatarUrl, stats }: Props) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState(avatarUrl);
  const [busy, setBusy] = useState(false);

  const publish = (url: string | null) => {
    setPhoto(url);
    window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: url }));
  };

  const upload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast('Файл больше 2 МБ', 'error');
      return;
    }
    setBusy(true);
    // новое фото видно сразу, сервер сохраняет его в фоне
    const local = URL.createObjectURL(file);
    publish(local);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post('/api/v1/me/avatar', fd);
      router.refresh();
    } catch (err) {
      publish(avatarUrl);
      toast(err instanceof ApiError ? err.message : 'Не удалось сохранить фото', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del('/api/v1/me/avatar');
      publish(null);
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
    } finally {
      setBusy(false);
    }
  };

  const tiles: Array<[string, number]> = [
    ['Визитов за 30 дней', stats.visits30],
    ['Выдано пациентам за 30 дней', stats.issued30],
    ['Пациентов всего', stats.patients],
    ['Личных шаблонов', stats.personalTemplates],
  ];

  return (
    <>
      <Card className={s.profile}>
        <button type="button" className={s.photo} onClick={() => input.current?.click()} disabled={busy} aria-label="Сменить фото профиля">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" />
          ) : (
            <span className={s.initials}>{initialsOf(name)}</span>
          )}
          <span className={s.photoHint}>Сменить</span>
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void upload(f);
          }}
        />
        <div className={s.who}>
          <span className={s.name}>{name}</span>
          <span className={s.muted}>{[title, roleLabel].filter(Boolean).join(' · ')}</span>
          <span className={s.email}>{email}</span>
          <div className={s.photoActions}>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
              {photo ? 'Сменить фото' : 'Загрузить фото'}
            </Button>
            {photo && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={remove}>
                Убрать
              </Button>
            )}
          </div>
        </div>
      </Card>

      <ul className={s.stats} aria-label="Статистика работы">
        {tiles.map(([label, value]) => (
          <li key={label} className={s.stat}>
            <span className={s.muted}>{label}</span>
            <span className={s.statValue}>{value}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
