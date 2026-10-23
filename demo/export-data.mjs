// Выгрузка данных прототипа из локальной базы: node demo/export-data.mjs <issueId>
// Берёт неизменяемый снимок выдачи, документы визита и позиции каталога, на которые ссылается карта.
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const issueId = process.argv[2];
if (!issueId) throw new Error('Укажите id выдачи');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? 'postgresql://sanabilis:sanabilis@localhost:5432/sanabilis' });
await db.connect();
const issue = (await db.query('select "visitId", snapshot from "VisitIssue" where id = $1', [issueId])).rows[0];
if (!issue) throw new Error('Выдача не найдена');
const documents = (
  await db.query('select id, type, rev, content, "templateVersionId" from "Document" where "visitId" = $1 order by "createdAt"', [issue.visitId])
).rows;
// производители образца: тестовые позиции из базы в прототип не попадают
const sampleBrands = JSON.parse(readFileSync(new URL('../prisma/sample-content.json', import.meta.url), 'utf8')).brushes.map((b) => b.brand);
const catalog = (
  await db.query(
    `select s.id, b.name as brand, s.line, s.label, s."isoSize", s."passageMm"::float8::text as "passageMm", s."bristleDiameterMm"::float8::text as "bristleDiameterMm",
            s."colorHex", s.verified, s."sortOrder", s."photoPath" is not null as "hasPhoto", s.archived
       from "BrushSize" s join "BrushBrand" b on b.id = s."brandId"
      where not s.archived and b.name = any($1) order by s."sortOrder", s."passageMm"`,
    [sampleBrands],
  )
).rows;

// Шаблоны библиотеки с текстами образца (в базе до заполнения клиникой в них TODO)
const sample = JSON.parse(readFileSync(new URL('../prisma/sample-content.json', import.meta.url), 'utf8'));
const textsFor = { 'Схема индивидуальной гигиены': sample.plan, [sample.aftercare.title]: sample.aftercare, ...sample.templates };
const rows = (
  await db.query(
    `select t.id, t.kind, t.title, t."updatedAt", v.version, v.structure
       from "Template" t join lateral (select version, structure from "TemplateVersion" where "templateId" = t.id order by version desc limit 1) v on true
      where t."ownerId" is null and t.status = 'ACTIVE' order by t."sortOrder", t."createdAt"`,
  )
).rows;
const templates = rows.map((r) => {
  const texts = textsFor[r.title] ?? {};
  for (const section of r.structure.sections) {
    for (const item of section.items) {
      if (item.type === 'text' && texts[section.title]) item.text = texts[section.title][0];
      if (item.type === 'warning' && texts.warning) [item.title, item.text] = texts.warning;
    }
  }
  return { id: r.id, kind: r.kind, title: r.title, personal: false, archived: false, version: r.version, updatedAt: r.updatedAt.toISOString(), hasDraft: false, structure: r.structure };
});
await db.end();
writeFileSync(new URL('./data.json', import.meta.url), JSON.stringify({ snapshot: issue.snapshot, documents, catalog, templates }));
console.log(`data.json: ${documents.length} документа, ${catalog.length} позиции каталога, ${templates.length} шаблонов`);
