import { describe, expect, it } from 'vitest';
import { lintPatientText } from '@/content/styleRules';
import { ui } from '@/content/ui.ru';

const rules = (t: string) => lintPatientText(t).map((i) => i.rule);

describe('правила текстов клиники', () => {
  it('Вы с заглавной', () => {
    expect(rules('Рекомендуем вам использовать')).toContain('pronoun');
    expect(rules('Рекомендуем Вам использовать')).not.toContain('pronoun');
  });
  it('лексика и обещания', () => {
    expect(rules('Профессиональная чистка')).toContain('cleaning');
    expect(rules('Дёсны кровоточат')).toContain('gum-plural');
    expect(rules('Установка импланта')).toContain('implant');
    expect(rules('Установка имплантата')).not.toContain('implant');
    expect(rules('после установки брекетов')).toContain('ortho');
    expect(rules('Лучший результат')).toContain('forbidden');
    expect(rules('Процедура безболезненна')).toContain('promise');
    expect(rules('Это не просто паста, а система')).toContain('construction');
    expect(rules('Готово!')).toContain('exclamation');
  });
  it('корректный текст без замечаний', () => {
    expect(lintPatientText('Используйте ёршик вечером. Если десна кровоточит, сообщите врачу.')).toEqual([]);
  });
  it('файл контента для пациента проходит линтер', () => {
    const patientTexts: string[] = Object.values(ui.patient);
    for (const t of patientTexts) expect(lintPatientText(t), t).toEqual([]);
  });
});
