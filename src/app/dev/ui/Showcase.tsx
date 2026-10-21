'use client';

import { useEffect, useState } from 'react';
import { glassClass } from '@/ui/Glass';
import { Heading, StepCounter } from '@/ui/Heading';
import { Logo } from '@/ui/Logo';
import { cx } from '@/ui/cx';
import { BentoSection } from './sections/BentoSection';
import { ControlsSection } from './sections/ControlsSection';
import { FoundationsSection } from './sections/FoundationsSection';
import { MapSection } from './sections/MapSection';
import s from './showcase.module.css';

export function Showcase() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={s.page}>
      <header className={cx(s.header, scrolled && glassClass, scrolled && s.headerScrolled)}>
        <div className={s.headerInner}>
          <Logo />
          <span className={s.headerMeta}>Витрина компонентов · этап 1</span>
        </div>
      </header>
      <main className={s.main}>
        <div className={s.hero}>
          <StepCounter current={1} total={7} />
          <Heading as="h1" level="display" rest="рабочего инструмента гигиениста.">
            Дизайн-система
          </Heading>
          <p className={s.lead}>
            Токены, типографика и компоненты, из которых собираются все экраны: визит, карта ёршиков, шаблоны,
            онлайн-карта пациента и печатный документ.
          </p>
        </div>
        <BentoSection />
        <MapSection />
        <ControlsSection />
        <FoundationsSection />
      </main>
    </div>
  );
}
