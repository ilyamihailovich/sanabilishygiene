'use client';

import { ui } from '@/content/ui.ru';
import { isMultiRooted, toothStateLabels, type ToothState } from '@/domain/teeth';
import { Button } from '@/ui/Button';
import { Switch } from '@/ui/Field';
import { IconCheck, IconPlus } from '@/ui/icons';
import s from './ToothForm.module.css';

const STATES: ToothState[] = ['PRESENT', 'MISSING', 'IMPLANT', 'PONTIC'];

interface ToothFormProps {
  tooth: number;
  state: ToothState;
  furcation: boolean;
  neighbours: number[];
  onState: (state: ToothState) => void;
  onFurcation: (value: boolean) => void;
  onAddExtra: (neighbour: number) => void;
}

export function ToothForm({ tooth, state, furcation, neighbours, onState, onFurcation, onAddExtra }: ToothFormProps) {
  return (
    <div className={s.form}>
      <div role="radiogroup" aria-label={ui.map.toothState} className={s.states}>
        {STATES.map((st) => (
          <button key={st} type="button" role="radio" aria-checked={state === st} className={s.state} onClick={() => onState(st)}>
            <span>{toothStateLabels[st]}</span>
            {state === st && <IconCheck size={18} />}
          </button>
        ))}
      </div>
      {state !== 'MISSING' && state !== 'PONTIC' && isMultiRooted(tooth) && (
        <Switch label={ui.map.furcation} checked={furcation} onCheckedChange={onFurcation} />
      )}
      {state !== 'MISSING' && neighbours.length > 0 && (
        <div className={s.extra}>
          <span className={s.label}>{ui.map.addExtra}</span>
          <div className={s.row}>
            {neighbours.map((n) => (
              <Button key={n} variant="secondary" size="sm" leading={<IconPlus size={16} />} onClick={() => onAddExtra(n)}>
                {tooth}/{n}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
