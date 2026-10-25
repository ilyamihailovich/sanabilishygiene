import type { Role } from '@/generated/prisma/enums';

export type Permission =
  | 'patient.write'
  | 'visit.write'
  | 'visit.delete'
  | 'document.write'
  | 'issue.create'
  | 'link.manage'
  | 'template.personal'
  | 'template.library'
  | 'catalog.manage'
  | 'texts.edit'
  | 'texts.approve'
  | 'users.manage'
  | 'audit.view'
  | 'settings.manage';

const clinical: Permission[] = ['patient.write', 'visit.write', 'visit.delete', 'document.write'];
const issuing: Permission[] = ['issue.create', 'link.manage', 'template.personal'];

const matrix: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([
    ...clinical,
    ...issuing,
    'template.library',
    'catalog.manage',
    'texts.edit',
    'users.manage',
    'audit.view',
    'settings.manage',
  ]),
  // врач — автор клинических текстов: правит шаблоны клиники и утверждает тексты оценок
  DOCTOR: new Set<Permission>([...clinical, ...issuing, 'texts.approve', 'template.library']),
  HYGIENIST: new Set<Permission>([...clinical, ...issuing]),
  ASSISTANT: new Set<Permission>(clinical),
};

export function can(role: Role, permission: Permission): boolean {
  return matrix[role].has(permission);
}

export const roleLabels: Record<Role, string> = {
  ADMIN: 'Администратор',
  DOCTOR: 'Врач',
  HYGIENIST: 'Гигиенист',
  ASSISTANT: 'Ассистент',
};
