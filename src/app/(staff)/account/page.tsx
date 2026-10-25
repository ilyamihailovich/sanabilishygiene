import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';
import { HotkeyOrder } from '@/features/account/HotkeyOrder';
import { LogoutAllCard } from '@/features/account/LogoutAllCard';
import { ProfileCard } from '@/features/account/ProfileCard';
import s from '@/features/account/account.module.css';
import { ui } from '@/content/ui.ru';
import { brushBrand, byBrandOrder } from '@/domain/brushes';
import { prefsSchema } from '@/schemas/prefs';
import { avatarUrl, requireStaff, staffInfo } from '@/server/auth/guard';
import { db } from '@/server/db';
import { listCatalog } from '@/server/services/catalog';
import { Heading } from '@/ui/Heading';

export default async function AccountPage() {
  const session = await requireStaff();
  const userId = session.user.id;
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [catalog, visits30, issued30, patients, personalTemplates] = await Promise.all([
    listCatalog(),
    db().visit.count({ where: { createdById: userId, createdAt: { gte: since } } }),
    db().visitIssue.count({ where: { issuedById: userId, issuedAt: { gte: since } } }),
    db().visit.findMany({ where: { createdById: userId }, distinct: ['patientId'], select: { patientId: true } }).then((r) => r.length),
    db().template.count({ where: { ownerId: userId, status: 'ACTIVE' } }),
  ]);
  const prefs = prefsSchema.parse(session.user.prefs ?? {});
  return (
    <div className={s.page}>
      <Heading as="h1" level="title1">
        {ui.nav.account}
      </Heading>
      <ProfileCard
        name={session.user.displayName}
        title={session.user.title}
        email={session.user.email}
        roleLabel={staffInfo(session).roleLabel}
        avatarUrl={avatarUrl(userId, prefs)}
        stats={{ visits30, issued30, patients, personalTemplates }}
      />
      <div className={s.columns}>
        {session.user.role !== 'ADMIN' && (
          <section className={s.section}>
            <HotkeyOrder items={byBrandOrder(catalog).map((c) => ({ id: c.id, label: c.label, colorHex: c.colorHex, brand: brushBrand(c) }))} initial={prefs.sizeHotkeys} />
          </section>
        )}
        <section className={s.section}>
          <h2 className={s.sectionTitle}>Безопасность</h2>
          <ChangePasswordForm />
          <LogoutAllCard />
        </section>
      </div>
    </div>
  );
}
