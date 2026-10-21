/*
  Демо-данные витрины. Цвета и обозначения размеров условные (не Curaprox):
  реальные значения вносит администратор в каталог после проверки клиникой.
*/
export interface DemoSize {
  id: string;
  label: string;
  meta: string;
  color: string;
  hotkey: string;
}

export const demoSizes: DemoSize[] = [
  { id: 'a', label: 'Демо 1', meta: 'проход 0,6 мм', color: '#f2c94c', hotkey: '1' },
  { id: 'b', label: 'Демо 2', meta: 'проход 0,8 мм', color: '#e86a3a', hotkey: '2' },
  { id: 'c', label: 'Демо 3', meta: 'проход 1,0 мм', color: '#3f8f5a', hotkey: '3' },
  { id: 'd', label: 'Демо 4', meta: 'проход 1,3 мм', color: '#2f6fb5', hotkey: '4' },
  { id: 'e', label: 'Демо 5', meta: 'проход 1,6 мм', color: '#8a4fb0', hotkey: '5' },
];

export interface DemoInterspace {
  key: string;
  label: string;
  sizeId: string | null;
  freeText?: string;
  bleeding: boolean;
  pain: boolean;
  openContact: boolean;
}

export const demoArc: DemoInterspace[] = [
  { key: '17-16', label: '17/16', sizeId: 'd', bleeding: false, pain: false, openContact: false },
  { key: '16-15', label: '16/15', sizeId: 'c', bleeding: true, pain: false, openContact: false },
  { key: '15-14', label: '15/14', sizeId: 'b', bleeding: false, pain: false, openContact: false },
  { key: '14-13', label: '14/13', sizeId: 'b', bleeding: false, pain: true, openContact: false },
  { key: '13-12', label: '13/12', sizeId: 'a', bleeding: false, pain: false, openContact: false },
  { key: '12-11', label: '12/11', sizeId: null, bleeding: false, pain: false, openContact: false },
  { key: '11-21', label: '11/21', sizeId: null, bleeding: false, pain: false, openContact: false },
  { key: '21-22', label: '21/22', sizeId: 'a', bleeding: true, pain: false, openContact: false },
  { key: '22-23', label: '22/23', sizeId: 'b', bleeding: false, pain: false, openContact: true },
  { key: '23-24', label: '23/24', sizeId: 'b', bleeding: false, pain: false, openContact: false },
  { key: '24-25', label: '24/25', sizeId: null, freeText: '1,5 мм', bleeding: false, pain: false, openContact: false },
  { key: '25-26', label: '25/26', sizeId: 'c', bleeding: false, pain: false, openContact: false },
  { key: '26-27', label: '26/27', sizeId: 'd', bleeding: true, pain: true, openContact: false },
];

export const demoPatients = [
  { card: '24-0187', name: 'Анна', date: '21.10.2026', boib: 18 },
  { card: '23-1142', name: 'Михаил', date: '20.10.2026', boib: 32 },
  { card: '26-0031', name: null, date: '20.10.2026', boib: 7 },
  { card: '25-0920', name: 'Елена', date: '17.10.2026', boib: 24 },
];
