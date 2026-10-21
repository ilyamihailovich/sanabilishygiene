/*
  Начальное наполнение базы. Повторный запуск безопасен: существующие записи не меняются.
  Медицинские тексты не выдумываются: там, где нужен текст клиники, стоит TODO, и выдача такого документа заблокирована.
*/
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client';
import { hashPassword } from '../src/server/auth/password';
import type { TemplateStructure } from '../src/schemas/template';

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

let counter = 0;
const id = (prefix: string) => `${prefix}${(++counter).toString(36).padStart(4, '0')}`;
const todo = (what: string) => ({ id: id('i'), type: 'text' as const, required: false, text: `TODO: ${what}` });

const hygienePlan: TemplateStructure = {
  schema: 1,
  sections: [
    { id: id('s'), title: 'Зубная щётка и паста', items: [todo('текст клиники о зубной щётке и пасте')] },
    { id: id('s'), title: 'Межзубные промежутки', items: [{ id: id('i'), type: 'brushes', required: false }, todo('текст клиники о межзубной гигиене')] },
    { id: id('s'), title: 'Дополнительные средства', items: [todo('средства гигиены по выбору врача')] },
    { id: id('s'), title: 'Когда обратиться в клинику', items: [{ id: id('i'), type: 'warning', required: false, title: 'TODO: заголовок', text: 'TODO: текст клиники' }] },
  ],
};

const aftercare = (sections: string[]): TemplateStructure => ({
  schema: 1,
  sections: [
    ...sections.map((title) => ({ id: id('s'), title, items: [todo(`текст клиники для раздела «${title}»`)] })),
    { id: id('s'), title: 'Когда обратиться в клинику', items: [{ id: id('i'), type: 'warning' as const, required: false, title: 'TODO: заголовок', text: 'TODO: текст клиники' }] },
  ],
});

const templates: Array<{ kind: 'HYGIENE_PLAN' | 'AFTERCARE'; title: string; structure: TemplateStructure }> = [
  { kind: 'HYGIENE_PLAN', title: 'Схема индивидуальной гигиены', structure: hygienePlan },
  { kind: 'AFTERCARE', title: 'После профессиональной гигиены', structure: aftercare(['Первые часы', 'Питание', 'Гигиена']) },
  { kind: 'AFTERCARE', title: 'После удаления зуба', structure: aftercare(['Первые сутки', 'Питание', 'Гигиена', 'Ограничения']) },
  { kind: 'AFTERCARE', title: 'После имплантации', structure: aftercare(['Первые сутки', 'Питание', 'Гигиена', 'Ограничения']) },
  { kind: 'AFTERCARE', title: 'После установки ортодонтической системы', structure: aftercare(['Первые дни', 'Питание', 'Гигиена']) },
];

/* Структура стандартного протокола PSR. Тексты для сотрудника — черновик, тексты для пациента даёт клиника. */
const psrTexts: Array<{ code: string; staffText: string; patientText: string }> = [
  { code: '0', staffText: 'Черновик, утвердить у врача: здоровые ткани пародонта, профилактика.', patientText: 'TODO: текст для пациента, код 0' },
  { code: '1', staffText: 'Черновик, утвердить у врача: кровоточивость при зондировании, обучение гигиене.', patientText: 'TODO: текст для пациента, код 1' },
  { code: '2', staffText: 'Черновик, утвердить у врача: зубные отложения или нависающие края реставраций.', patientText: 'TODO: текст для пациента, код 2' },
  { code: '3', staffText: 'Черновик, утвердить у врача: карманы средней глубины, пародонтологическое обследование секстанта.', patientText: 'TODO: текст для пациента, код 3' },
  { code: '4', staffText: 'Черновик, утвердить у врача: глубокие карманы, полное пародонтологическое обследование.', patientText: 'TODO: текст для пациента, код 4' },
  { code: '*', staffText: 'Черновик, утвердить у врача: клинические особенности (фуркация, подвижность, рецессия).', patientText: 'TODO: текст для пациента, отметка *' },
];

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@sanabilis.local').toLowerCase();
  if (!(await db.user.findUnique({ where: { email: adminEmail } }))) {
    const password = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(9).toString('base64url');
    await db.user.create({
      data: { email: adminEmail, displayName: 'Администратор', role: 'ADMIN', passwordHash: await hashPassword(password), mustChangePassword: !process.env.SEED_ADMIN_PASSWORD },
    });
    console.log(`Администратор: ${adminEmail}, временный пароль: ${password}`);
  }

  const brand = await db.brushBrand.upsert({ where: { name: 'Curaprox' }, create: { name: 'Curaprox' }, update: {} });
  if ((await db.brushSize.count()) === 0) {
    // Заглушки: данные по размерам и цветам предоставит клиника. Без флага «проверено» в документ пациента не попадают.
    await db.brushSize.createMany({
      data: [
        { brandId: brand.id, line: 'TODO: линейка', label: 'TODO 1', passageMm: 0.6, colorHex: '#9a9aa0', sortOrder: 1 },
        { brandId: brand.id, line: 'TODO: линейка', label: 'TODO 2', passageMm: 0.8, colorHex: '#6e6e73', sortOrder: 2 },
      ],
    });
  }

  for (const t of psrTexts) {
    await db.psrText.upsert({ where: { code: t.code }, create: t, update: {} });
  }

  const admin = await db.user.findUniqueOrThrow({ where: { email: adminEmail } });
  for (const [i, t] of templates.entries()) {
    if (await db.template.findFirst({ where: { title: t.title, ownerId: null } })) continue;
    await db.template.create({
      data: {
        kind: t.kind,
        title: t.title,
        sortOrder: i,
        publishedVersion: 1,
        versions: { create: { version: 1, structure: t.structure as unknown as Prisma.InputJsonValue, createdById: admin.id } },
      },
    });
  }

  if (process.env.SEED_DEMO === 'true') await seedDemo();
}

/** Демо-сотрудники для локальной проверки. Не запускать на рабочем сервере. */
async function seedDemo() {
  const demo = [
    { email: 'doctor@sanabilis.local', displayName: 'Анна Сергеевна Иванова', title: 'врач-пародонтолог', role: 'DOCTOR' as const },
    { email: 'hygienist@sanabilis.local', displayName: 'Мария Петрова', title: 'гигиенист стоматологический', role: 'HYGIENIST' as const },
    { email: 'assistant@sanabilis.local', displayName: 'Ольга Смирнова', title: 'ассистент', role: 'ASSISTANT' as const },
  ];
  for (const u of demo) {
    if (await db.user.findUnique({ where: { email: u.email } })) continue;
    await db.user.create({ data: { ...u, passwordHash: await hashPassword('demo-password'), mustChangePassword: false } });
  }
  console.log('Демо-сотрудники созданы, пароль demo-password');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
