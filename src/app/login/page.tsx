import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/features/auth/LoginForm';
import { getSession } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Вход' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string; next?: string }> }) {
  if (await getSession()) redirect('/');
  const { reason, next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return <LoginForm idle={reason === 'idle'} next={safeNext} />;
}
