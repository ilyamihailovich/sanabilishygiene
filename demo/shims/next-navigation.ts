// next/navigation для прототипа без сервера: переходы внутри страницы
import { navigate, usePath } from '../router';

const noop = () => undefined;
export const useRouter = () => ({ push: navigate, replace: navigate, refresh: noop, back: noop, prefetch: noop });
export const usePathname = usePath;
export const notFound = noop;
export const redirect = navigate;
