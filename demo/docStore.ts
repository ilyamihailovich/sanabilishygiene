import { useSyncExternalStore } from 'react';
import type { VisitDoc } from '@/features/visit/VisitWorkspace';

// Документы визитов прототипа в памяти: создаются и удаляются через подменённый API
const docs = new Map<string, VisitDoc[]>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const EMPTY: VisitDoc[] = [];

export function seedDocs(visitId: string, list: VisitDoc[]) {
  docs.set(visitId, list);
}

export function addDoc(visitId: string, doc: VisitDoc) {
  docs.set(visitId, [...(docs.get(visitId) ?? []), doc]);
  emit();
}

export function removeDoc(id: string) {
  for (const [visitId, list] of docs) docs.set(visitId, list.filter((d) => d.id !== id));
  emit();
}

export function useDocs(visitId: string) {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => docs.get(visitId) ?? EMPTY,
    () => docs.get(visitId) ?? EMPTY,
  );
}

export function getDocs(visitId: string): VisitDoc[] {
  return docs.get(visitId) ?? EMPTY;
}
