import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { navigate } from '../router';

// Ссылки внутри приложения переключают экран прототипа
export default function Link({ href, children, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || href.includes('/pdf')) return;
        e.preventDefault();
        navigate(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
