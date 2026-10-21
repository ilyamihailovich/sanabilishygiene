import { audit } from '@/server/audit';
import { ok, readJson, staff } from '@/server/http';
import { getSettings, saveSettings, settingsSchema } from '@/server/settings';

export const GET = staff('settings.manage', async () => ok(await getSettings()));

export const PUT = staff('settings.manage', async ({ req, session }) => {
  const next = await readJson(req, settingsSchema);
  await saveSettings(next);
  await audit({ userId: session.user.id, action: 'settings.update', entityType: 'settings', entityId: 'app' });
  return ok(next);
});
