/*
  Начальное наполнение базы. Повторный запуск безопасен: существующие записи не меняются.
  Медицинские тексты не выдумываются: там, где нужен текст клиники, стоит TODO, и выдача такого документа заблокирована.
*/
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
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

/**
 * Демо-режим для локального просмотра (SEED_DEMO=true). Не запускать на рабочем сервере:
 * демо-сотрудники, образец каталога, текстов PSR и шагов из prisma/sample-content.json, пациент с заполненной картой.
 * Образец не утверждён клиникой и не является её данными.
 */
async function seedDemo() {
  const sample = JSON.parse(readFileSync(new URL('./sample-content.json', import.meta.url), 'utf8')) as {
    doctor: { displayName: string; title: string };
    patient: { cardNumber: string; displayName: string; fullName: string };
    brushes: { brand: string; line: string; sizes: Array<[string, number, string]> };
    psr: Record<string, { staff: string; patient: string }>;
    brushSteps: string[];
  };
  const demo = [
    { email: 'doctor@sanabilis.local', ...sample.doctor, role: 'DOCTOR' as const },
    { email: 'hygienist@sanabilis.local', displayName: 'Мария Петрова', title: 'гигиенист стоматологический', role: 'HYGIENIST' as const },
    { email: 'assistant@sanabilis.local', displayName: 'Ольга Смирнова', title: 'ассистент', role: 'ASSISTANT' as const },
  ];
  for (const u of demo) {
    if (await db.user.findUnique({ where: { email: u.email } })) continue;
    await db.user.create({ data: { ...u, passwordHash: await hashPassword('demo-password'), mustChangePassword: false } });
  }
  const doctor = await db.user.findUniqueOrThrow({ where: { email: 'doctor@sanabilis.local' } });

  const { line } = sample.brushes;
  const brand = await db.brushBrand.upsert({ where: { name: sample.brushes.brand }, create: { name: sample.brushes.brand }, update: {} });
  for (const [i, [label, passageMm, colorHex]] of sample.brushes.sizes.entries()) {
    await db.brushSize.upsert({
      where: { brandId_line_label: { brandId: brand.id, line, label } },
      create: { brandId: brand.id, line, label, passageMm, colorHex, verified: true, sortOrder: i + 1 },
      update: {},
    });
  }

  for (const [code, text] of Object.entries(sample.psr)) {
    const row = await db.psrText.findUnique({ where: { code } });
    if (row && !row.patientText.startsWith('TODO')) continue;
    await db.psrText.update({
      where: { code },
      data: { staffText: text.staff, patientText: text.patient, approved: true, approvedById: doctor.id },
    });
  }

  if (!(await db.setting.findUnique({ where: { key: 'brushSteps' } }))) {
    await db.setting.create({
      data: { key: 'brushSteps', value: sample.brushSteps },
    });
  }

  if (!(await db.patient.findUnique({ where: { cardNumber: sample.patient.cardNumber } }))) {
    const ids = (await db.brushSize.findMany({ where: { brandId: brand.id }, orderBy: { sortOrder: 'asc' } })).map((x) => x.id);
    const pick = (a: number, b: number) => {
      const i = Math.min(a % 10, b % 10);
      return ids[i <= 2 ? 0 : i <= 4 ? 1 : i === 5 ? 2 : 3]!;
    };
    const order = [
      [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27],
      [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37],
    ];
    const elements: Record<string, object> = {};
    for (const arch of order) {
      for (let k = 0; k + 1 < arch.length; k++) {
        const a = arch[k]!;
        const b = arch[k + 1]!;
        elements[`${a}-${b}`] = { size: { catalogId: pick(a, b) }, bleeding: [16, 26, 36].includes(a) || [16, 26, 36].includes(b) ? true : null };
      }
    }
    elements['11-21'] = { size: null, alternative: 'FLOSS' };
    const teeth = Object.fromEntries(
      [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28, 48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38].map((t) => [
        String(t),
        { state: t % 10 === 8 ? 'MISSING' : 'PRESENT', furcation: t === 46 },
      ]),
    );
    const patient = await db.patient.create({ data: { ...sample.patient, createdById: doctor.id } });
    const visit = await db.visit.create({
      data: { patientId: patient.id, date: new Date(new Date().toISOString().slice(0, 10)), clinicianId: doctor.id, createdById: doctor.id, nextVisitMonths: 6 },
    });
    await db.document.create({
      data: { visitId: visit.id, type: 'BRUSH_MAP', authorId: doctor.id, content: { schema: 1, teeth, elements, extras: [] } as Prisma.InputJsonValue },
    });
    const sx = (code: number) => ({ code, asterisk: false });
    await db.document.create({
      data: {
        visitId: visit.id,
        type: 'PSR',
        authorId: doctor.id,
        psrMaxCode: 2,
        psrAsterisk: false,
        content: { schema: 1, sextants: { S1: sx(2), S2: sx(1), S3: sx(2), S4: sx(1), S5: sx(1), S6: sx(0) } } as Prisma.InputJsonValue,
      },
    });
  }
  console.log(`Демо-режим: сотрудники с паролем demo-password, образец каталога, пациент ${sample.patient.cardNumber}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
