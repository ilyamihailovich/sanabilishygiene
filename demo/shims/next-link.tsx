import type { AnchorHTMLAttributes, ReactNode } from 'react';

// В прототипе ссылки внутри приложения никуда не ведут
export default function Link({ href: _href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) {
  return (
    <a href="#" onClick={(e) => e.preventDefault()} {...rest}>
      {children}
    </a>
  );
}
