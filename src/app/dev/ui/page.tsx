import type { Metadata } from 'next';
import { Showcase } from './Showcase';

export const metadata: Metadata = { title: 'Витрина компонентов' };

/* TODO(этап 2): закрыть витрину авторизацией администратора. */
export default function Page() {
  return <Showcase />;
}
