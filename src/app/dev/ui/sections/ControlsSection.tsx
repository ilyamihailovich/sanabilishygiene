'use client';

import { useState } from 'react';
import { ui } from '@/content/ui.ru';
import { Button } from '@/ui/Button';
import { Card, CardHeader } from '@/ui/Card';
import { CounterChip, ToggleChip } from '@/ui/Chip';
import { Switch, TextField } from '@/ui/Field';
import { GlassPanel } from '@/ui/Glass';
import { StepCounter } from '@/ui/Heading';
import { IconButton } from '@/ui/IconButton';
import { ConcentricBackdrop } from '@/ui/ConcentricBackdrop';
import { IconArrowRight, IconArrowUpRight, IconDownload, IconLink, IconPlus, IconPrint, IconQr, IconRedo, IconShare, IconUndo } from '@/ui/icons';
import { Notice } from '@/ui/Notice';
import { Segmented } from '@/ui/Segmented';
import { Section } from './Section';
import s from './controls.module.css';

export function ControlsSection() {
  const [mode, setMode] = useState<'three' | 'scheme'>('three');
  const [chips, setChips] = useState({ bleeding: true, pain: false });
  const [autoHide, setAutoHide] = useState(true);

  return (
    <Section id="controls" title="Элементы управления." rest="Капсулы, круглые кнопки, чипы.">
      <div className={s.grid}>
        <Card>
          <div className={s.stack}>
            <CardHeader title="Кнопки" meta={<CounterChip>4 варианта</CounterChip>} />
            <div className={s.row}>
              <Button trailing={<IconArrowRight size={18} />}>Начать визит</Button>
              <Button variant="secondary" leading={<IconDownload size={18} />}>
                PDF
              </Button>
              <Button variant="surface" leading={<IconPrint size={18} />}>
                Печать
              </Button>
              <Button variant="ghost">Пропустить</Button>
            </div>
            <div className={s.row}>
              <Button size="sm">Малая</Button>
              <Button size="lg" variant="secondary" leading={<IconQr size={20} />}>
                Выдать пациенту
              </Button>
              <Button disabled>Недоступно</Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className={s.stack}>
            <CardHeader title="Круглые кнопки" meta={<CounterChip>36–52 px</CounterChip>} />
            <div className={s.row}>
              <IconButton label="Открыть" icon={<IconArrowUpRight size={20} />} />
              <IconButton label="Далее" icon={<IconArrowRight size={20} />} variant="accent" />
              <IconButton label="Добавить" icon={<IconPlus size={20} />} variant="muted" />
              <IconButton label="Поделиться" icon={<IconShare size={20} />} variant="muted" size={36} />
              <IconButton label="Отменить" icon={<IconUndo size={20} />} variant="ghost" />
              <IconButton label="Повторить" icon={<IconRedo size={20} />} variant="ghost" disabled />
            </div>
          </div>
        </Card>

        <Card className={s.wide}>
          <div className={s.stack}>
            <CardHeader title="Стекло" meta={<CounterChip>над сценой и на индиго</CounterChip>} />
            <div className={s.glassGrid}>
              <div className={s.glassStage}>
                <ConcentricBackdrop className={s.stageRings} />
                <div className={s.stageDots} aria-hidden="true">
                  {['#f2c94c', '#e86a3a', '#3f8f5a', '#2f6fb5', '#8a4fb0', '#e86a3a', '#3f8f5a'].map((c, i) => (
                    <span key={i} style={{ background: c }} />
                  ))}
                </div>
                <div className={s.stageContent}>
                  <div className={s.row}>
                    <Button variant="glass" leading={<IconDownload size={18} />}>
                      PDF
                    </Button>
                    <Button variant="glass" leading={<IconShare size={18} />}>
                      Поделиться
                    </Button>
                    <IconButton label="Отменить" icon={<IconUndo size={20} />} variant="glass" />
                    <IconButton label="Повторить" icon={<IconRedo size={20} />} variant="glass" />
                  </div>
                  <div className={s.row}>
                    <CounterChip tone="glass">14 промежутков</CounterChip>
                    <Notice glass>{ui.catalog.notVerified}</Notice>
                  </div>
                  <GlassPanel aria-label="Пример стеклянной панели">
                    <IconButton label="Отменить" icon={<IconUndo size={20} />} variant="ghost" />
                    <IconButton label="Повторить" icon={<IconRedo size={20} />} variant="ghost" />
                    <IconButton label="Выдать" icon={<IconQr size={20} />} variant="ghost" active />
                  </GlassPanel>
                </div>
              </div>
              <div className={s.glassStageAccent}>
                <div className={s.stageContent}>
                  <span className={s.accentTitle}>Выдача пациенту</span>
                  <div className={s.row}>
                    <Button variant="glassDark" leading={<IconLink size={18} />}>
                      Скопировать ссылку
                    </Button>
                    <Button variant="glassDark" leading={<IconPrint size={18} />}>
                      Печать
                    </Button>
                  </div>
                  <div className={s.row}>
                    <Button variant="surface" leading={<IconDownload size={18} />}>
                      PDF
                    </Button>
                    <IconButton label="QR-код" icon={<IconQr size={20} />} variant="glassDark" />
                    <IconButton label="Далее" icon={<IconArrowRight size={20} />} variant="glassDark" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className={s.stack}>
            <CardHeader title="Чипы и сегмент" />
            <div className={s.row}>
              <CounterChip>14 промежутков</CounterChip>
              <CounterChip>3 размера</CounterChip>
              <StepCounter current={1} total={5} />
            </div>
            <div className={s.row}>
              <ToggleChip pressed={chips.bleeding} onPressedChange={(v) => setChips({ ...chips, bleeding: v })}>
                {ui.interspace.bleeding}
              </ToggleChip>
              <ToggleChip pressed={chips.pain} onPressedChange={(v) => setChips({ ...chips, pain: v })}>
                {ui.interspace.pain}
              </ToggleChip>
            </div>
            <div className={s.row}>
              <Segmented
                label={ui.mapMode.label}
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'three', label: ui.mapMode.three },
                  { value: 'scheme', label: ui.mapMode.scheme },
                ]}
              />
              <Notice>{ui.catalog.notVerified}</Notice>
            </div>
          </div>
        </Card>

        <Card>
          <div className={s.stack}>
            <CardHeader title="Поля" />
            <TextField label="Номер медицинской карты" placeholder="Например, 24-0187" inputMode="text" />
            <TextField label="Имя для обращения" defaultValue="Анна" hint="Необязательно. Выводится в документе пациента." />
            <TextField label="Повторный визит, месяцев" defaultValue="13" error="Укажите от 1 до 12 месяцев" />
            <Switch label="Выход после 15 минут бездействия" checked={autoHide} onCheckedChange={setAutoHide} />
          </div>
        </Card>
      </div>
    </Section>
  );
}
