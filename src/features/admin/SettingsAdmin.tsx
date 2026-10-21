'use client';

import { useState } from 'react';
import { lintPatientText } from '@/content/styleRules';
import { ui } from '@/content/ui.ru';
import type { Settings } from '@/server/settings';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Card, CardHeader } from '@/ui/Card';
import { TextArea, TextField } from '@/ui/Field';
import { Heading } from '@/ui/Heading';
import { useToast } from '@/ui/Toast';
import s from './admin.module.css';

export function SettingsAdmin({ initial }: { initial: Settings }) {
  const toast = useToast();
  const [v, setV] = useState(initial);
  const save = async () => {
    try {
      await api.put('/api/v1/admin/settings', { ...v, brushSteps: v.brushSteps.filter((x) => x.trim()) });
      toast(ui.common.saved);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
    }
  };
  const steps = [0, 1, 2, 3].map((i) => v.brushSteps[i] ?? '');
  return (
    <div className={s.page}>
      <div className={s.head}>
        <Heading as="h1" level="title1">
          {ui.admin.settings}
        </Heading>
        <Button onClick={save}>{ui.common.save}</Button>
      </div>
      <div className={s.bento} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
        <Card className={s.textCard}>
          <CardHeader title="Сеанс" />
          <TextField
            label={ui.admin.idleTimeout}
            inputMode="numeric"
            value={String(v.idleTimeoutMin)}
            onChange={(e) => setV({ ...v, idleTimeoutMin: Number(e.target.value) || 5 })}
            hint="От 5 до 240 минут"
          />
        </Card>
        <Card className={s.textCard}>
          <CardHeader title="Контакты клиники" />
          <TextField label={ui.admin.clinicName} value={v.clinic.name} onChange={(e) => setV({ ...v, clinic: { ...v.clinic, name: e.target.value } })} />
          <TextField label={ui.admin.clinicAddress} value={v.clinic.address} onChange={(e) => setV({ ...v, clinic: { ...v.clinic, address: e.target.value } })} />
          <TextField label={ui.admin.clinicPhone} value={v.clinic.phone} onChange={(e) => setV({ ...v, clinic: { ...v.clinic, phone: e.target.value } })} />
          <TextField label={ui.admin.clinicSite} value={v.clinic.site} onChange={(e) => setV({ ...v, clinic: { ...v.clinic, site: e.target.value } })} />
        </Card>
        <Card className={s.textCard}>
          <CardHeader title={ui.admin.brushSteps} />
          <p className={s.muted}>Тексты даёт клиника. Пока в шагах есть TODO, блок не показывается пациенту.</p>
          {steps.map((text, i) => (
            <div key={i} className={s.form} style={{ gap: 4 }}>
              <TextArea
                label={`Шаг ${String(i + 1).padStart(2, '0')}`}
                value={text}
                onChange={(e) => {
                  const next = [...steps];
                  next[i] = e.target.value;
                  setV({ ...v, brushSteps: next });
                }}
              />
              {lintPatientText(text).length > 0 && (
                <span style={{ color: 'var(--color-notice-text)', fontSize: 'var(--fs-caption)' }}>
                  {lintPatientText(text).map((x) => `${x.message}: «${x.match}»`).join('; ')}
                </span>
              )}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
