import { TemplateLibrary } from '@/features/templates/TemplateLibrary';
import { requireStaff } from '@/server/auth/guard';
import { listTemplates } from '@/server/services/templates';
import { templateStructureSchema } from '@/schemas/template';

export default async function TemplatesPage() {
  const session = await requireStaff();
  const templates = await listTemplates(session);
  return (
    <TemplateLibrary
      templates={templates.map((t) => ({
        id: t.id,
        kind: t.kind,
        title: t.title,
        personal: t.ownerId !== null,
        archived: t.status === 'ARCHIVED',
        version: t.versions[0]?.version ?? null,
        updatedAt: t.updatedAt.toISOString(),
        hasDraft: t.draft !== null,
        // опубликованная версия: её видит врач, который не может править шаблон клиники
        structure: t.versions[0] ? templateStructureSchema.parse(t.versions[0].structure) : null,
      }))}
    />
  );
}
