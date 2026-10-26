import { notFound, redirect } from 'next/navigation';
import { can, roleLabels, type Permission } from '../rbac';
import { getSession, type CurrentSession } from './session';
import { prefsSchema } from '@/schemas/prefs';
import type { StaffInfo } from '@/features/shell/StaffContext';

const ALL: Permission[] = [
  'patient.write',
  'visit.write',
  'visit.delete',
  'document.write',
  'issue.create',
  'link.manage',
  'template.personal',
  'template.library',
  'catalog.manage',
  'texts.edit',
  'texts.approve',
  'users.manage',
  'audit.view',
  'settings.manage',
];

/** Для серверных страниц: сессия обязательна, при нехватке прав — 404. */
export async function requireStaff(permission?: Permission): Promise<CurrentSession> {
  const session = await getSession();
  if (!session) redirect('/login');
  if (permission && !can(session.user.role, permission)) notFound();
  return session;
}

export function staffInfo(session: CurrentSession): StaffInfo {
  return {
    id: session.user.id,
    displayName: session.user.displayName,
    role: session.user.role,
    roleLabel: roleLabels[session.user.role],
    title: session.user.title,
    permissions: ALL.filter((p) => can(session.user.role, p)),
    prefs: prefsSchema.parse(session.user.prefs ?? {}),
    idleTimeoutMin: session.idleTimeoutMin,
    avatarUrl: avatarUrl(session.user.id, prefsSchema.parse(session.user.prefs ?? {})),
  };
}

/** Адрес фото профиля или null, если фото не загружено. */
export function avatarUrl(userId: string, prefs: { avatar: string | null; avatarRev: number }): string | null {
  return prefs.avatar ? `/api/v1/files/avatar/${userId}?v=${prefs.avatarRev}` : null;
}
