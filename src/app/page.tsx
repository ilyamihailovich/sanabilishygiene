import { redirect } from 'next/navigation';

/* До этапа 2 корень ведёт на витрину компонентов. */
export default function Home() {
  redirect('/dev/ui');
}
