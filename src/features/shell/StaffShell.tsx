'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ui } from '@/content/ui.ru';
import { api } from '@/ui/api';
import { cx } from '@/ui/cx';
import { glassClass } from '@/ui/Glass';
import { IconDoc, IconHome, IconLogout, IconSettings, IconUser } from '@/ui/icons';
import { Logo } from '@/ui/Logo';
import { spring } from '@/ui/motion';
import { Popover } from '@/ui/Popover';
import { ToastProvider } from '@/ui/Toast';
import { AVATAR_EVENT } from '../account/ProfileCard';
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

  // Нижнее меню телефона: выбранная вкладка до завершения перехода и положение подложки
  const routeTab = items.findIndex((item) => item.match(pathname));
  const [pendingTab, setPendingTab] = useState<number | null>(null);
  const [blurKey, setBlurKey] = useState(0);
  const activeTab = pendingTab ?? routeTab;
  const tabbarRef = useRef<HTMLElement>(null);
  const [thumb, setThumb] = useState<{ x: number; width: number } | null>(null);
  useEffect(() => setPendingTab(null), [pathname]);
  // направление смахивания: новая вкладка правее — экран въезжает справа
  const prevTab = useRef(routeTab);
  const slideFrom = useRef(0);
  if (prevTab.current !== routeTab) {
    slideFrom.current = routeTab > prevTab.current ? 1 : -1;
    prevTab.current = routeTab;
  }
  useLayoutEffect(() => {
    const nav = tabbarRef.current;
    const tab = nav?.querySelectorAll<HTMLElement>(`.${s.tab}`)[activeTab];
    setThumb(tab ? { x: tab.offsetLeft, width: tab.offsetWidth } : null);
  }, [activeTab, items.length]);

  // фото из профиля сменилось: шапка показывает его сразу, без перезагрузки
  const [avatar, setAvatar] = useState(staff.avatarUrl ?? null);
  useEffect(() => setAvatar(staff.avatarUrl ?? null), [staff.avatarUrl]);
  useEffect(() => {
    const on = (e: Event) => setAvatar((e as CustomEvent<string | null>).detail);
    window.addEventListener(AVATAR_EVENT, on);
    return () => window.removeEventListener(AVATAR_EVENT, on);
  }, []);

  const initials = staff.displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

  return (
    <StaffProvider value={staff}>
      <ToastProvider>
        <header className={cx(s.header, scrolled && s.scrolled)}>
          <div className={s.headerInner}>
            <Link href="/" className={s.brand} aria-label={ui.nav.home}>
              <Logo height={14} />
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {avatar ? <img src={avatar} alt="" className={s.avatarImg} /> : initials}
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

        {/* смена раздела: короткое размытие экрана; два одинаковых класса перезапускают анимацию без пересоздания страницы */}
        <main className={cx(s.main, blurKey > 0 && (blurKey % 2 ? s.mainSwitchA : s.mainSwitchB))}>
          {/* раздел въезжает со стороны нажатой вкладки, как смахивание экрана */}
          <motion.div
            key={routeTab}
            initial={slideFrom.current === 0 ? false : { x: slideFrom.current * 56, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            {children}
          </motion.div>
        </main>

        <nav ref={tabbarRef} className={cx(glassClass, s.tabbar)} aria-label="Разделы">
          {/* одна подложка на всё меню: переезжает к нажатой кнопке сразу, не дожидаясь загрузки раздела */}
          {thumb && <motion.span className={s.tabThumb} initial={false} animate={thumb} transition={spring} />}
          {items.map((item, i) => {
            const active = i === activeTab;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={s.tab}
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  if (i === activeTab) return;
                  setPendingTab(i);
                  setBlurKey((k) => k + 1);
                }}
              >
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
