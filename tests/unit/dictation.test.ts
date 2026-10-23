import { describe, expect, it } from 'vitest';
import { emptyBrushMap, listElements, setToothState } from '@/domain/brushMap';
import { parseDictation, type DictationSize } from '@/domain/dictation';

const catalog: DictationSize[] = [
  { id: 'cs6', brand: 'Curasept Proxi', passageMm: '0.6' },
  { id: 'cp6', brand: 'Curaprox Prime', passageMm: '0.6' },
  { id: 'tp6', brand: 'TePe Original', passageMm: '0.6' },
  { id: 'tp8', brand: 'TePe Original', passageMm: '0.8' },
  { id: 'tp13', brand: 'TePe Original', passageMm: '1.3' },
];
const elements = listElements(emptyBrushMap());
const parse = (text: string, brand: string | null = null) => parseDictation(text, { elements, catalog, brand });

describe('голосовой ввод', () => {
  it('промежуток словами, производитель, размер и кровоточивость', () => {
    const r = parse('шестнадцать пятнадцать тепе ноль шесть кровоточивость');
    expect(r.unknown).toEqual([]);
    expect(r.actions).toEqual([
      { kind: 'select', key: expect.any(String), label: '16/15' },
      { kind: 'brand', brand: 'TePe Original' },
      { kind: 'size', catalogId: 'tp6', brand: 'TePe Original', mm: '0.6' },
      { kind: 'bleeding', value: true },
    ]);
  });

  it('цифры от распознавания: «16 15 0,8», «1615», «сорок шесть сорок пять»', () => {
    expect(parse('16 15 0,8', 'TePe Original').actions.map((a) => a.kind)).toEqual(['select', 'size']);
    expect(parse('1615', 'TePe Original').actions[0]).toMatchObject({ kind: 'select', label: '16/15' });
    expect(parse('сорок шесть сорок пять').actions[0]).toMatchObject({ kind: 'select', label: '46/45' });
  });

  it('размер без производителя берётся у текущего, при неоднозначности просит назвать', () => {
    expect(parse('ноль восемь', 'TePe Original').actions).toEqual([{ kind: 'size', catalogId: 'tp8', brand: 'TePe Original', mm: '0.8' }]);
    const r = parse('ноль шесть');
    expect(r.actions).toEqual([]);
    expect(r.unknown[0]).toMatch(/назовите производителя/);
  });

  it('«одна целая три», «1 3 мм» и «06» — размеры', () => {
    expect(parse('одна целая три', 'TePe Original').actions[0]).toMatchObject({ catalogId: 'tp13' });
    expect(parse('1 3 мм', 'TePe Original').actions[0]).toMatchObject({ catalogId: 'tp13' });
    expect(parse('06', 'TePe Original').actions[0]).toMatchObject({ catalogId: 'tp6' });
  });

  it('состояния зубов, нить, без кровоточивости, дальше и отмена', () => {
    expect(parse('тридцать шесть имплантат двадцать пять коронка восемнадцать отсутствует').actions).toEqual([
      { kind: 'tooth', tooth: 36, state: 'IMPLANT' },
      { kind: 'tooth', tooth: 25, state: 'CROWN' },
      { kind: 'tooth', tooth: 18, state: 'MISSING' },
    ]);
    expect(parse('нить дальше без кровоточивости отмена').actions.map((a) => a.kind)).toEqual(['floss', 'next', 'bleeding', 'undo']);
  });

  it('несуществующий промежуток и непонятные слова уходят в unknown', () => {
    const map = setToothState(emptyBrushMap(), 15, 'MISSING');
    const r = parseDictation('шестнадцать пятнадцать абракадабра', { elements: listElements(map), catalog, brand: null });
    expect(r.actions).toEqual([]);
    expect(r.unknown).toHaveLength(2);
  });
});
