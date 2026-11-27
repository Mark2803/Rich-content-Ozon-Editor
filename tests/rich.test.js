// Запуск: npm test (node --test). База и сеть не нужны.
import test from 'node:test';
import assert from 'node:assert/strict';
import { toOzon, fromOzon, resolveImage, check, newBlock, productUrl } from '../public/rich.js';
import { PRESETS } from '../public/presets.js';

test('картинка для телефона подставляется из ПК и наоборот', () => {
  const onlyPc = resolveImage('chess', { src: 'https://x.ru/a.png', srcM: '', w: 1000, h: 800 });
  assert.equal(onlyPc.srcM, 'https://x.ru/a.png');
  assert.deepEqual([onlyPc.wM, onlyPc.hM], [1000, 800]);
  const onlyM = resolveImage('chess', { src: '', srcM: 'https://x.ru/m.png', wM: 640, hM: 640 });
  assert.equal(onlyM.src, 'https://x.ru/m.png');
  assert.deepEqual([onlyM.w, onlyM.h], [640, 640]);
  const none = resolveImage('hero', { src: 'https://x.ru/h.jpg' });
  assert.deepEqual([none.wM, none.hM], [640, 800], 'размер по умолчанию, пока картинка не загрузилась');
});

test('шаблоны собираются в JSON Ozon нужного вида', () => {
  for (const key of ['shu', 'gaba']) {
    const json = toOzon(PRESETS[key].blocks());
    assert.equal(json.version, 0.3);
    const kinds = json.content.map((w) => w.widgetName + ':' + (w.type || w.theme));
    assert.deepEqual(kinds, ['raShowcase:billboard', 'raShowcase:chess', 'raTextBlock:primary', 'raShowcase:tileL', 'raTextBlock:secondary', 'raShowcase:tileL', 'raTextBlock:primary', 'list:image', 'list:bullet', 'raShowcase:roll']);
    const chess = json.content[1].blocks;
    assert.deepEqual(chess.map((b) => b.reverse), [false, true, false], 'шахматка чередуется');
    for (const w of json.content) for (const b of w.blocks || []) if (b.img) {
      assert.ok(b.img.srcMobile && b.img.widthMobile > 0 && b.img.heightMobile > 0, 'у каждой картинки есть версия и размер для телефона');
    }
  }
});

test('ссылки: SKU превращается в адрес товара, чужие сайты не проходят', () => {
  assert.equal(productUrl(' 5211050462 '), 'https://www.ozon.ru/product/5211050462/');
  assert.equal(productUrl('abc'), '');
  const roll = newBlock('roll');
  roll.items[0].link = 'https://evil.example/';
  assert.equal(toOzon([roll]).content[0].blocks[0].imgLink, '');
  assert.ok(check([roll]).some((p) => p.includes('не на ozon.ru')));
});

test('импорт чужого JSON и обратный экспорт сохраняют содержимое', () => {
  const original = toOzon(PRESETS.shu.blocks());
  const { blocks, skipped } = fromOzon(JSON.stringify(original));
  assert.deepEqual(skipped, []);
  const again = toOzon(blocks);
  assert.deepEqual(again, original);
});

test('импорт формата со строками в content (как у части продавцов)', () => {
  const json = { version: 0.3, content: [
    { widgetName: 'raShowcase', type: 'chess', blocks: [{ img: { src: 'https://a.ru/1.jpg', srcMobile: 'https://a.ru/1.jpg', widthMobile: 1067, heightMobile: 800, position: 'fill', positionMobile: 'fill' }, imgLink: '', reverse: false, title: { content: ['Смола Ча Гао ', '(Шу Пуэр)'] }, text: { content: ['Текст'] } }] },
    { widgetName: 'raShowcase', type: 'chess', blocks: [{ img: { src: 'https://a.ru/2.jpg', srcMobile: 'https://a.ru/2m.jpg', widthMobile: 640, heightMobile: 640 }, title: { content: ['Второй'] }, text: { content: [] } }] },
    { widgetName: 'raVideo', blocks: [] },
  ] };
  const { blocks, skipped } = fromOzon(json);
  assert.equal(blocks.length, 1, 'подряд идущие шахматки склеены');
  assert.equal(blocks[0].items.length, 2);
  assert.equal(blocks[0].items[0].title, 'Смола Ча Гао \n(Шу Пуэр)');
  assert.equal(blocks[0].items[1].img.srcM, 'https://a.ru/2m.jpg');
  assert.deepEqual(skipped, ['raVideo']);
});

test('проверка находит типичные ошибки', () => {
  const chess = newBlock('chess');
  chess.items = [chess.items[0]];
  chess.items[0].img.src = 'https://drive.google.com/file/d/xyz/view';
  const p = check([chess]);
  assert.ok(p.some((x) => x.includes('от 2 до 6')));
  assert.ok(p.some((x) => x.includes('.jpg')));
  assert.deepEqual(check(PRESETS.shu.blocks()).filter((x) => !x.startsWith('Без SKU')), []);
});

test('пароль базы уходит в переменные окружения psql, а не в командную строку', async () => {
  const { pgEnv } = await import('../pg-env.js');
  const env = pgEnv('"postgresql://tea:p%40ss%7Cw@127.0.0.1:5432/teamarket?schema=public"');
  assert.deepEqual(env, { PGHOST: '127.0.0.1', PGPORT: '5432', PGUSER: 'tea', PGPASSWORD: 'p@ss|w', PGDATABASE: 'teamarket' });
  assert.throws(() => pgEnv('mysql://a@b/c'));
});
