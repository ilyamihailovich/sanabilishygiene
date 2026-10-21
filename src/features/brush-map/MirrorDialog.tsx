'use client';

import { useState } from 'react';
import { ui } from '@/content/ui.ru';
import type { Arch, Side } from '@/domain/teeth';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Segmented } from '@/ui/Segmented';
import s from './editor.module.css';

export function MirrorDialog({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: (arch: Arch, from: Side) => void }) {
  const [arch, setArch] = useState<Arch>('upper');
  const [from, setFrom] = useState<Side>('right');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={ui.map.mirrorTitle}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {ui.common.cancel}
          </Button>
          <Button
            onClick={() => {
              onApply(arch, from);
              onClose();
            }}
          >
            {ui.common.copy}
          </Button>
        </>
      }
    >
      <div className={s.dialogStack}>
        <Segmented
          label="Челюсть"
          block
          value={arch}
          onChange={setArch}
          options={[
            { value: 'upper', label: ui.map.upper },
            { value: 'lower', label: ui.map.lower },
          ]}
        />
        <Segmented
          label="Направление"
          block
          value={from}
          onChange={setFrom}
          options={[
            { value: 'right', label: ui.map.mirrorRight },
            { value: 'left', label: ui.map.mirrorLeft },
          ]}
        />
        <p className={s.muted}>{ui.map.mirrorConfirm}</p>
      </div>
    </Dialog>
  );
}
