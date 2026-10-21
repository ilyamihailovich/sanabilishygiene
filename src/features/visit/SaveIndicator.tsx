import { ui } from '@/content/ui.ru';
import type { SaveState } from './useAutosave';

const labels: Record<SaveState, string> = {
  idle: '',
  saving: ui.common.saving,
  saved: ui.common.saved,
  error: 'Нет связи, повторим сохранение',
  stale: 'Документ изменён на другом устройстве. Обновите страницу.',
};

export function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span role="status" aria-live="polite" style={{ fontSize: 'var(--fs-caption)', color: state === 'stale' || state === 'error' ? 'var(--color-notice-text)' : 'var(--color-text-secondary)' }}>
      {labels[state]}
    </span>
  );
}
