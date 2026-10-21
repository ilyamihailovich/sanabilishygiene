/*
  Правила клиники для текстов, которые видит пациент.
  Линтер подсказывает, но не исправляет: решение за человеком.
*/

export interface StyleIssue {
  rule: string;
  message: string;
  match: string;
  index: number;
}

interface Rule {
  rule: string;
  pattern: RegExp;
  message: string;
}

const rules: Rule[] = [
  { rule: 'pronoun', pattern: /(?<![А-Яа-яЁё])(вы|вас|вам|вами|ваш|ваша|ваше|ваши|вашего|вашей|вашему|вашим|вашими|ваших|вашу)(?![А-Яа-яЁё])/g, message: 'Вы, Вас, Вам, Ваш пишутся с заглавной буквы' },
  { rule: 'cleaning', pattern: /чистк[аиуеойё]\w*/gi, message: 'Для процедуры используйте «гигиена» вместо «чистка»' },
  { rule: 'gum-plural', pattern: /(?<![А-Яа-яЁё])(д[её]сны|д[её]снам|д[её]снами|д[её]снах|д[её]сен)(?![А-Яа-яЁё])/gi, message: '«Десна» в единственном числе' },
  { rule: 'implant', pattern: /(?<![А-Яа-яЁё])имплант(?!ат)[а-яё]*/gi, message: 'Правильно «имплантат»' },
  { rule: 'ortho', pattern: /брекет\w*|элайнер\w*/gi, message: 'Используйте «ортодонтическая система»' },
  { rule: 'forbidden', pattern: /идеальн\w*|лучш\w*|(?<![A-Za-z])VIP(?![A-Za-z])|довери\w*|в нашей клинике|реклам\w*/gi, message: 'Запрещённое слово' },
  { rule: 'promise', pattern: /безболезненн\w*|(?<![А-Яа-яЁё])быстр\w*|комфортн\w*|щадящ\w*/gi, message: 'Запрещённое обещание' },
  { rule: 'construction', pattern: /не просто[^.]*?,\s*а|не только[^.]*?,?\s*но и|,\s*а не(?![А-Яа-яЁё])/gi, message: 'Запрещённая конструкция' },
  { rule: 'exclamation', pattern: /!/g, message: 'Без восклицательных знаков' },
  { rule: 'emoji', pattern: /\p{Extended_Pictographic}/gu, message: 'Без эмодзи' },
];

export function lintPatientText(text: string): StyleIssue[] {
  const issues: StyleIssue[] = [];
  for (const r of rules) {
    for (const m of text.matchAll(r.pattern)) {
      issues.push({ rule: r.rule, message: r.message, match: m[0], index: m.index ?? 0 });
    }
  }
  return issues.sort((a, b) => a.index - b.index);
}

export const TODO_MARK = 'TODO';
export const hasTodo = (text: string) => text.includes(TODO_MARK);
