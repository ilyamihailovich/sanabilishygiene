import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';
import { HotkeyOrder } from '@/features/account/HotkeyOrder';
import { LogoutAllCard } from '@/features/account/LogoutAllCard';
import s from '@/features/account/account.module.css';
import { ui } from '@/content/ui.ru';
import { prefsSchema } from '@/schemas/prefs';
import { requireStaff } from '@/server/auth/guard';
import { listCatalog } from '@/server/services/catalog';
import { Heading } from '@/ui/Heading';

export default async function AccountPage() {
  const session = await requireStaff();
  const catalog = await listCatalog();
  const prefs = prefsSchema.parse(session.user.prefs ?? {});
  return (
    <div className={s.stack}>
      <Heading as="h1" level="title1" rest={session.user.displayName}>
        {ui.nav.account}
      </Heading>
      <ChangePasswordForm />
      {session.user.role !== 'ADMIN' && (
        <HotkeyOrder items={catalog.map((c) => ({ id: c.id, label: c.label, colorHex: c.colorHex }))} initial={prefs.sizeHotkeys} />
      )}
      <LogoutAllCard />
    </div>
  );
}
