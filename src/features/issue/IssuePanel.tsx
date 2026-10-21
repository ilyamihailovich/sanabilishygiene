'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ui } from '@/content/ui.ru';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Card, CardHeader } from '@/ui/Card';
import { ConfirmDialog } from '@/ui/Dialog';
import { IconDownload, IconExpand, IconLink, IconPrint, IconQr } from '@/ui/icons';
import { formatDateTime } from '@/ui/format';
import { useToast } from '@/ui/Toast';
import s from './issue.module.css';

interface Props {
  visitId: string;
  blockers: string[];
  share: string | null;
  lastIssue: { id: string; number: number; issuedAt: string } | null;
  canIssue: boolean;
  canManageLink: boolean;
  hasDocuments: boolean;
}

/** Выдача пациенту: проверка готовности, QR-код, ссылка, PDF, печать, отзыв ссылки. */
export function IssuePanel({ visitId, blockers, share, lastIssue, canIssue, canManageLink, hasDocuments }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ url: string | null; qr: string | null } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    if (!canManageLink || !share) {
      setLink(share ? { url: share, qr: null } : null);
      return;
    }
    api.get<{ url: string | null; qr: string | null }>(`/api/v1/visits/${visitId}/share`).then(setLink).catch(() => setLink(null));
  }, [visitId, share, canManageLink]);

  const issue = async () => {
    setBusy(true);
    try {
      await api.post(`/api/v1/visits/${visitId}/issue`);
      toast('Документы выданы');
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link?.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast(ui.common.copied);
    } catch {
      toast(link.url);
    }
  };

  const rotate = async () => {
    await api.post(`/api/v1/visits/${visitId}/share/rotate`).catch((e) => toast(e.message, 'error'));
    router.refresh();
  };

  const revoke = async () => {
    await api.post(`/api/v1/visits/${visitId}/share/revoke`).catch((e) => toast(e.message, 'error'));
    toast(ui.issue.revoked);
    router.refresh();
  };

  const pdfUrl = lastIssue ? `/api/v1/issues/${lastIssue.id}/pdf` : null;

  return (
    <div className={s.root}>
      <Card className={s.qrCard}>
        {lastIssue && link?.url ? (
          <>
            <div className={s.qr} aria-label="QR-код ссылки на онлайн-карту" role="img" dangerouslySetInnerHTML={{ __html: link.qr ?? '' }} />
            <span className={s.url}>{link.url}</span>
            <div className={s.actions}>
              <Button leading={<IconLink size={18} />} onClick={copy}>
                {ui.issue.copyLink}
              </Button>
              <a href={pdfUrl!} download>
                <Button variant="secondary" leading={<IconDownload size={18} />} tabIndex={-1}>
                  {ui.issue.pdf}
                </Button>
              </a>
              <a href={`${pdfUrl}?inline=1`} target="_blank" rel="noreferrer">
                <Button variant="secondary" leading={<IconPrint size={18} />} tabIndex={-1}>
                  {ui.issue.print}
                </Button>
              </a>
            </div>
          </>
        ) : lastIssue ? (
          <>
            <p className={s.revoked}>{ui.issue.revoked}</p>
            {canManageLink && (
              <Button leading={<IconQr size={18} />} onClick={rotate}>
                {ui.issue.rotate}
              </Button>
            )}
          </>
        ) : (
          <>
            <IconQr size={48} />
            <p className={s.revoked}>QR-код и ссылка появятся после выдачи</p>
          </>
        )}
      </Card>

      <div className={s.side}>
        <Card>
          <CardHeader title={blockers.length ? ui.issue.blocked : hasDocuments ? ui.issue.ready : ui.issue.noDocuments} />
          {blockers.length > 0 && (
            <ul className={s.blockers}>
              {blockers.map((b) => (
                <li key={b} className={s.blocker}>
                  {b}
                </li>
              ))}
            </ul>
          )}
          {lastIssue && (
            <p className={s.muted}>
              {ui.issue.lastIssue}: № {lastIssue.number}, {formatDateTime(lastIssue.issuedAt)}
            </p>
          )}
          <div className={s.actions} style={{ justifyContent: 'flex-start', marginTop: 'var(--space-5)' }}>
            {canIssue && (
              <Button size="lg" disabled={busy || blockers.length > 0} onClick={issue}>
                {busy ? ui.issue.rendering : lastIssue ? ui.issue.reissue : ui.issue.issue}
              </Button>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Показать пациенту" />
          <p className={s.muted}>Полноэкранная 3D-карта для объяснения в кресле, с режимом «Анатомия».</p>
          <div className={s.actions} style={{ justifyContent: 'flex-start', marginTop: 'var(--space-4)' }}>
            <Link href={`/visits/${visitId}/present`}>
              <Button variant="secondary" leading={<IconExpand size={18} />} tabIndex={-1}>
                Открыть
              </Button>
            </Link>
            {lastIssue && link?.url && canManageLink && (
              <>
                <Button variant="ghost" onClick={rotate}>
                  {ui.issue.rotate}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmRevoke(true)}>
                  {ui.issue.revoke}
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
      <ConfirmDialog
        open={confirmRevoke}
        title={`${ui.issue.revoke}?`}
        text="Пациент больше не сможет открыть карту по этой ссылке и QR-коду."
        confirmLabel={ui.issue.revoke}
        onClose={() => setConfirmRevoke(false)}
        onConfirm={revoke}
      />
    </div>
  );
}
