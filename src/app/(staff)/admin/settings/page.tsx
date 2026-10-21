import { SettingsAdmin } from '@/features/admin/SettingsAdmin';
import { requireStaff } from '@/server/auth/guard';
import { getSettings } from '@/server/settings';

export default async function SettingsPage() {
  await requireStaff('settings.manage');
  return <SettingsAdmin initial={await getSettings()} />;
}
