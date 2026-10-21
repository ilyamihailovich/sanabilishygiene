'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ui } from '@/content/ui.ru';
import { api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';

const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
const PING_EVERY_MS = 2 * 60 * 1000;

/** Автоматический выход после бездействия: предупреждение за минуту, продление сессии на сервере при активности. */
export function IdleWatcher({ minutes }: { minutes: number }) {
  const router = useRouter();
  const [warn, setWarn] = useState(false);
  const last = useRef(Date.now());
  const lastPing = useRef(Date.now());

  useEffect(() => {
    const onActivity = () => {
      last.current = Date.now();
      if (Date.now() - lastPing.current > PING_EVERY_MS) {
        lastPing.current = Date.now();
        api.get('/api/v1/me').catch(() => undefined);
      }
    };
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const timer = setInterval(() => {
      const idle = Date.now() - last.current;
      const limit = minutes * 60 * 1000;
      if (idle >= limit) {
        clearInterval(timer);
        api.post('/api/v1/auth/logout').catch(() => undefined);
        router.replace('/login?reason=idle');
      } else {
        setWarn(idle >= limit - 60 * 1000);
      }
    }, 5000);
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(timer);
    };
  }, [minutes, router]);

  const stay = () => {
    last.current = Date.now();
    lastPing.current = Date.now();
    api.get('/api/v1/me').catch(() => undefined);
    setWarn(false);
  };

  return (
    <Dialog open={warn} onClose={stay} title={ui.auth.idleWarning} actions={<Button onClick={stay}>{ui.auth.stay}</Button>}>
      {null}
    </Dialog>
  );
}
