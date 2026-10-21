import type { AuditActor } from '@/generated/prisma/enums';
import type { Prisma } from '@/generated/prisma/client';
import { db } from './db';

interface AuditEntry {
  actor?: AuditActor;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  meta?: Prisma.InputJsonValue;
}

/** Журнал действий. Персональные данные в meta не пишем. */
export async function audit(entry: AuditEntry): Promise<void> {
  await db().auditLog.create({
    data: {
      actor: entry.actor ?? 'STAFF',
      userId: entry.userId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      ...(entry.meta === undefined ? {} : { meta: entry.meta }),
    },
  });
}

export const auditActionLabels: Record<string, string> = {
  'auth.login': 'Вход',
  'auth.logout': 'Выход',
  'auth.logout_all': 'Выход на всех устройствах',
  'auth.password': 'Смена пароля',
  'user.create': 'Создание сотрудника',
  'user.update': 'Изменение сотрудника',
  'user.reset_password': 'Сброс пароля',
  'patient.create': 'Создание пациента',
  'patient.update': 'Изменение пациента',
  'visit.create': 'Создание визита',
  'visit.update': 'Изменение визита',
  'visit.delete': 'Удаление визита',
  'document.create': 'Создание документа',
  'document.update': 'Изменение документа',
  'document.delete': 'Удаление документа',
  'issue.create': 'Выдача пациенту',
  'link.revoke': 'Отзыв ссылки',
  'link.rotate': 'Новая ссылка',
  'link.open': 'Открытие карты пациентом',
  'pdf.download': 'Выгрузка PDF',
  'catalog.update': 'Изменение каталога',
  'texts.update': 'Изменение текстов',
  'texts.approve': 'Утверждение текстов',
  'template.create': 'Создание шаблона',
  'template.publish': 'Публикация шаблона',
  'template.archive': 'Архивирование шаблона',
  'settings.update': 'Изменение настроек',
};
