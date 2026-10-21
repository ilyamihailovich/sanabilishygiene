'use client';

import { useRouter } from 'next/navigation';
import { ui } from '@/content/ui.ru';
import { api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import s from './account.module.css';

export function LogoutAllCard() {
  const router = useRouter();
  return (
    <Card className={s.card}>
      <div className={s.form}>
        <p className={s.muted}>Завершает все сеансы, включая этот. Используйте, если вошли на чужом устройстве.</p>
        <div>
          <Button
            variant="secondary"
            onClick={async () => {
              await api.post('/api/v1/auth/logout-all').catch(() => undefined);
              router.replace('/login');
            }}
          >
            {ui.auth.logoutAll}
          </Button>
        </div>
      </div>
    </Card>
  );
}
