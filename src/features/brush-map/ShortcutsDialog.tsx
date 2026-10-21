import { ui } from '@/content/ui.ru';
import { Dialog } from '@/ui/Dialog';
import s from './editor.module.css';

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={ui.map.shortcuts} width={560}>
      <dl className={s.shortcuts}>
        {ui.shortcuts.map(([keys, label]) => (
          <div key={keys} style={{ display: 'contents' }}>
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
