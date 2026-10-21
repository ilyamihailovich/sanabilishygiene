import type { ReactNode } from 'react';
import { CounterChip } from '@/ui/Chip';
import { Heading } from '@/ui/Heading';
import s from '../showcase.module.css';

interface SectionProps {
  id: string;
  title: string;
  rest?: string;
  counter?: string;
  children: ReactNode;
}

export function Section({ id, title, rest, counter, children }: SectionProps) {
  return (
    <section className={s.section} aria-labelledby={id}>
      <div className={s.sectionHead}>
        <Heading id={id} level="title2" rest={rest}>
          {title}
        </Heading>
        {counter && <CounterChip>{counter}</CounterChip>}
      </div>
      {children}
    </section>
  );
}
