'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Prefs } from '@/schemas/prefs';
import type { Permission } from '@/server/rbac';

export interface StaffInfo {
  id: string;
  displayName: string;
  role: 'ADMIN' | 'DOCTOR' | 'HYGIENIST' | 'ASSISTANT';
  roleLabel: string;
  /** Должность для подписи: «врач-пародонтолог». Без неё — роль. */
  title?: string | null;
  permissions: Permission[];
  prefs: Prefs;
  idleTimeoutMin: number;
  /** Фото сотрудника для аватара; без него — инициалы. */
  avatarUrl?: string | null;
}

const Ctx = createContext<StaffInfo | null>(null);

export function StaffProvider({ value, children }: { value: StaffInfo; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStaff(): StaffInfo {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStaff вне StaffProvider');
  return v;
}

export const useCan = (p: Permission) => useStaff().permissions.includes(p);
