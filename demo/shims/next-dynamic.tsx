import { Suspense, lazy, type ComponentType, type ReactNode } from 'react';

// next/dynamic через React.lazy
export default function dynamic<P extends object>(loader: () => Promise<ComponentType<P>>, opts?: { loading?: () => ReactNode }) {
  const Lazy = lazy(async () => ({ default: await loader() }));
  return function Dynamic(props: P) {
    return (
      <Suspense fallback={opts?.loading?.() ?? null}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}
