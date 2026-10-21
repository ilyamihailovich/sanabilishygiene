import Link from 'next/link';
import { ui } from '@/content/ui.ru';
import s from '@/features/admin/admin.module.css';
import { requireStaff } from '@/server/auth/guard';
import { db } from '@/server/db';
import { CounterChip } from '@/ui/Chip';
import { Heading } from '@/ui/Heading';
import { IconArrowUpRight } from '@/ui/icons';
import { Notice } from '@/ui/Notice';

export default async function AdminPage() {
  await requireStaff('users.manage');
  const [users, unverified, unapproved] = await Promise.all([
    db().user.count({ where: { isActive: true } }),
    db().brushSize.count({ where: { verified: false, archived: false } }),
    db().psrText.count({ where: { approved: false } }),
  ]);
  const tiles = [
    { href: '/admin/users', title: ui.admin.users, meta: <CounterChip>{users}</CounterChip> },
    { href: '/admin/catalog', title: ui.admin.catalog, meta: unverified ? <Notice>{ui.catalog.notVerified}</Notice> : <CounterChip>проверен</CounterChip> },
    { href: '/admin/texts', title: ui.admin.texts, meta: unapproved ? <Notice>{`Не утверждено: ${unapproved}`}</Notice> : <CounterChip>утверждены</CounterChip> },
    { href: '/admin/audit', title: ui.admin.audit, meta: null },
    { href: '/admin/settings', title: ui.admin.settings, meta: null },
    { href: '/dev/ui', title: 'Дизайн-система', meta: <CounterChip>витрина</CounterChip> },
  ];
  return (
    <div className={s.page}>
      <Heading as="h1" level="title1">
        {ui.admin.title}
      </Heading>
      <div className={s.bento}>
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className={s.tile}>
            <span className={s.row} style={{ justifyContent: 'space-between' }}>
              <span className={s.tileTitle}>{t.title}</span>
              <IconArrowUpRight size={20} />
            </span>
            <span>{t.meta}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
