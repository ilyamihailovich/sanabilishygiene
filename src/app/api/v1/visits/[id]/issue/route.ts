import { ok, staff } from '@/server/http';
import { issueVisit } from '@/server/services/issue';
import { prepareIssueFiles } from '@/server/services/renderer';

export const POST = staff<{ id: string }>('issue.create', async ({ params, session }) => {
  const { issue, url } = await issueVisit(params.id, session.user.id);
  // Рендер ракурсов и PDF готовятся в фоне; если сервис рендера недоступен, PDF соберётся при первом запросе
  void prepareIssueFiles(issue.id).catch((e) => console.error('renderer', e));
  return ok({ issueId: issue.id, number: issue.number, url });
});
