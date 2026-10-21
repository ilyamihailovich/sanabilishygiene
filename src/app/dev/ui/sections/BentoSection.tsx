import { Card, CardFooter, CardHeader } from '@/ui/Card';
import { CounterChip } from '@/ui/Chip';
import { IconButton } from '@/ui/IconButton';
import { IconArrowRight, IconArrowUpRight, IconChevronRight } from '@/ui/icons';
import { Notice } from '@/ui/Notice';
import { demoPatients } from '../demo-data';
import { Section } from './Section';
import s from './bento.module.css';

export function BentoSection() {
  return (
    <Section id="bento" title="Главный экран." rest="Бенто-сетка карточек.">
      <div className={s.bento}>
        <Card tone="accent" className={s.start} padding={32}>
          <span className={s.startMeta}>Вторник, 21 октября</span>
          <h3 className={s.startTitle}>
            Начать визит <span className={s.startRest}>по номеру медицинской карты</span>
          </h3>
          <form className={s.searchRow} action="#" role="search">
            <label htmlFor="bento-card" className="visually-hidden">
              Номер медицинской карты
            </label>
            <input id="bento-card" className={s.searchInput} placeholder="Номер медкарты" autoComplete="off" />
            <IconButton label="Найти или создать" icon={<IconArrowRight size={20} />} size={52} type="submit" />
          </form>
        </Card>

        <Card className={s.recent} padding={28}>
          <CardHeader
            title="Последние пациенты"
            meta={<CounterChip>{demoPatients.length}</CounterChip>}
            action={<IconButton label="Все пациенты" icon={<IconArrowUpRight size={20} />} variant="muted" size={40} />}
          />
          <ul className={s.list}>
            {demoPatients.map((p) => (
              <li key={p.card} className={s.item}>
                <span className={s.who}>
                  <span className={s.card}>{p.card}</span>
                  <span className={s.sub}>{p.name ?? 'Без имени'}</span>
                </span>
                <span className={s.sub}>{p.date}</span>
                <CounterChip>BOIB {p.boib} %</CounterChip>
              </li>
            ))}
          </ul>
        </Card>

        <Card interactive className={s.drafts}>
          <CardHeader title="Черновики" action={<IconChevronRight size={20} />} />
          <CardFooter>
            <span className={s.big}>2</span>
            <span className={s.sub}>изменены сегодня</span>
          </CardFooter>
        </Card>

        <Card interactive className={s.templates}>
          <CardHeader title="Шаблоны" action={<IconChevronRight size={20} />} />
          <CardFooter>
            <span className={s.big}>5</span>
            <span className={s.sub}>3 личных</span>
          </CardFooter>
        </Card>

        <Card className={s.catalog}>
          <CardHeader title="Каталог ёршиков" />
          <CardFooter>
            <Notice>Каталог не проверен</Notice>
          </CardFooter>
        </Card>
      </div>
    </Section>
  );
}
