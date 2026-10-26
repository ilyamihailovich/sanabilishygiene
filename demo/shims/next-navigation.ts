// next/navigation для прототипа без сервера: переходы внутри страницы с записью в историю браузера
import { back, navigate, replace, usePath } from '../router';

const noop = () => undefined;
export const useRouter = () => ({ push: navigate, replace, refresh: noop, back, prefetch: noop });
export const usePathname = usePath;
export const notFound = noop;
export const redirect = navigate;
