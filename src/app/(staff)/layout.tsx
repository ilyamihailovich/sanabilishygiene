import type { ReactNode } from 'react';
import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';
import { StaffShell } from '@/features/shell/StaffShell';
import { requireStaff, staffInfo } from '@/server/auth/guard';

export const dynamic = 'force-dynamic';

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const session = await requireStaff();
  return (
    <StaffShell staff={staffInfo(session)}>
      {session.user.mustChangePassword ? <ChangePasswordForm forced /> : children}
    </StaffShell>
  );
}
