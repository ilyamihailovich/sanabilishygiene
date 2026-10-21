import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';
import { LogoutAllCard } from '@/features/account/LogoutAllCard';
import { Heading } from '@/ui/Heading';
import { ui } from '@/content/ui.ru';
import s from '@/features/account/account.module.css';

export default function AccountPage() {
  return (
    <div className={s.stack}>
      <Heading as="h1" level="title1">
        {ui.nav.account}
      </Heading>
      <ChangePasswordForm />
      <LogoutAllCard />
    </div>
  );
}
