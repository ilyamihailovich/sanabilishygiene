import { UsersAdmin } from '@/features/admin/UsersAdmin';
import { requireStaff } from '@/server/auth/guard';
import { db } from '@/server/db';
import { userSelect } from '@/server/services/users';

export default async function UsersPage() {
  const session = await requireStaff('users.manage');
  const users = await db().user.findMany({ select: userSelect, orderBy: { displayName: 'asc' } });
  return <UsersAdmin selfId={session.user.id} users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))} />;
}
