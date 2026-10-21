'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ui } from '@/content/ui.ru';
import { api } from '@/ui/api';
import { cx } from '@/ui/cx';
import { glassClass } from '@/ui/Glass';
import { IconDoc, IconHome, IconLogout, IconSettings, IconUser } from '@/ui/icons';
import { Logo, Mark } from '@/ui/Logo';
import { spring } from '@/ui/motion';
import { Popover } from '@/ui/Popover';
import { ToastProvider } from '@/ui/Toast';
import { IdleWatcher } from './IdleWatcher';
import { StaffProvider, type StaffInfo } from './StaffContext';
import s from './shell.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  match: (path: string) => boolean;
}

export function StaffShell({ staff, children }: { staff: StaffInfo; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const userRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const items: NavItem[] = [
    { href: '/', label: ui.nav.home, icon: <IconHome size={22} />, match: (p) => p === '/' || p.startsWith('/visits') },
    { href: '/patients', label: ui.nav.patients, icon: <IconUser size={22} />, match: (p) => p.startsWith('/patients') },
    { href: '/templates', label: ui.nav.templates, icon: <IconDoc size={22} />, match: (p) => p.startsWith('/templates') },
    ...(staff.permissions.includes('users.manage')
      ? [{ href: '/admin', label: 'Админ', icon: <IconSettings size={22} />, match: (p: string) => p.startsWith('/admin') }]
      : []),
  ];

  const logout = async () => {
    await api.post('/api/v1/auth/logout').catch(() => undefined);
    router.replace('/login');
  };

  const initials = staff.displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

  return (
    <StaffProvider value={staff}>
      <ToastProvider>
        <header className={cx(s.header, scrolled && glassClass, scrolled && s.scrolled)}>
          <div className={s.headerInner}>
            <Link href="/" className={s.brand} aria-label={ui.nav.home}>
              <Mark size={30} />
              <Logo height={12} />
            </Link>
            <nav className={s.nav} aria-label="Разделы">
              {items.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link key={item.href} href={item.href} className={s.navLink} aria-current={active ? 'page' : undefined}>
                    {active && <motion.span layoutId="nav-thumb" className={s.navThumb} transition={spring} />}
                    <span className={s.navText}>{item.href === '/admin' ? ui.nav.admin : item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <button ref={userRef} type="button" className={s.user} onClick={() => setMenu((m) => !m)} aria-haspopup="dialog" aria-expanded={menu}>
              <span className={s.userText}>
                <span className={s.userName}>{staff.displayName}</span> <span className={s.userRole}>· {staff.roleLabel}</span>
              </span>
              <span className={s.avatar} aria-hidden="true">
                {initials}
              </span>
            </button>
          </div>
        </header>

        <Popover open={menu} onClose={() => setMenu(false)} anchor={userRef} label={ui.nav.account}>
          <div className={s.menu}>
            <Link href="/account" className={s.menuItem} onClick={() => setMenu(false)}>
              <IconUser size={20} /> {ui.nav.account}
            </Link>
            {staff.permissions.includes('texts.approve') && (
              <Link href="/admin/texts" className={s.menuItem} onClick={() => setMenu(false)}>
                <IconDoc size={20} /> Тексты на утверждение
              </Link>
            )}
            <button type="button" className={s.menuItem} onClick={logout}>
              <IconLogout size={20} /> {ui.nav.logout}
            </button>
          </div>
        </Popover>

        <main className={s.main}>{children}</main>

        <nav className={cx(glassClass, s.tabbar)} aria-label="Разделы">
          {items.map((item) => {
            const active = item.match(pathname);
            return (
              <Link key={item.href} href={item.href} className={s.tab} aria-current={active ? 'page' : undefined}>
                {active && <motion.span layoutId="tab-thumb" className={s.tabThumb} transition={spring} />}
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <IdleWatcher minutes={staff.idleTimeoutMin} />
      </ToastProvider>
    </StaffProvider>
  );
}
