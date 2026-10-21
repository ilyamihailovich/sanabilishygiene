import type { Metadata } from 'next';
import { requireStaff } from '@/server/auth/guard';
import { Showcase } from './Showcase';

export const metadata: Metadata = { title: 'Витрина компонентов' };

export default async function Page() {
  await requireStaff('users.manage');
  return <Showcase />;
}
