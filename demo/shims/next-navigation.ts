// Заглушка next/navigation для прототипа без сервера
const noop = () => undefined;
export const useRouter = () => ({ push: noop, replace: noop, refresh: noop, back: noop, prefetch: noop });
export const usePathname = () => '/';
export const notFound = noop;
export const redirect = noop;
