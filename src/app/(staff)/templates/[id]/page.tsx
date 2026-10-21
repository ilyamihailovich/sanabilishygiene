import { notFound } from 'next/navigation';
import { TemplateEditor } from '@/features/templates/TemplateEditor';
import { requireStaff } from '@/server/auth/guard';
import { canEditTemplate, currentStructure, getEditableTemplate } from '@/server/services/templates';

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  const { id } = await params;
  const t = await getEditableTemplate(session, id).catch(() => null);
  if (!t || !canEditTemplate(session, t)) notFound();
  return (
    <TemplateEditor
      id={t.id}
      title={t.title}
      kind={t.kind}
      archived={t.status === 'ARCHIVED'}
      library={t.ownerId === null}
      version={t.versions[0]?.version ?? 0}
      hasDraft={t.draft !== null}
      structure={currentStructure(t)}
    />
  );
}
