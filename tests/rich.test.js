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
    { widgetName: 'raVideo', type: 'youtube', id: 'dQw4w9WgXcQ' },
    { widgetName: 'raCarousel', blocks: [] },
  ] };
  const { blocks, skipped } = fromOzon(json);
  assert.equal(blocks.length, 2, 'подряд идущие шахматки склеены, видео — отдельный блок');
  assert.equal(blocks[1].type, 'video');
  assert.equal(blocks[0].items.length, 2);
  assert.equal(blocks[0].items[0].title, 'Смола Ча Гао \n(Шу Пуэр)');
  assert.equal(blocks[0].items[1].img.srcM, 'https://a.ru/2m.jpg');
  assert.deepEqual(skipped, ['raCarousel']);
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

test('стиль текста: размер, цвет и выравнивание уходят в JSON и возвращаются при импорте', async () => {
  const { SIZES, COLORS } = await import('../public/rich.js');
  assert.equal(Object.keys(SIZES).length, 7);
  assert.equal(Object.keys(COLORS).length, 4);
  const b = newBlock('chess');
  b.style = { title: { size: 'size6', color: 'color2', align: 'center' } };
  const w = toOzon([b]).content[0];
  assert.deepEqual([w.blocks[0].title.size, w.blocks[0].title.color, w.blocks[0].title.align], ['size6', 'color2', 'center']);
  assert.equal(w.blocks[0].text.size, 'size3', 'не заданное берётся по умолчанию');
  const back = fromOzon(toOzon([b])).blocks[0];
  assert.equal(back.style.title.size, 'size6');
  assert.equal(back.style.title.color, 'color2');
});

test('эмодзи и символы проходят в текст как есть', () => {
  const b = newBlock('text');
  b.title = '🍵 Смола шу пуэра ✓';
  assert.equal(toOzon([b]).content[0].title.items[0].content, '🍵 Смола шу пуэра ✓');
});

test('новые блоки: нумерованный список, таблица, видео, кнопка-ссылка', async () => {
  const { questionsUrl, youtubeId } = await import('../public/rich.js');
  const num = newBlock('numlist');
  assert.equal(toOzon([num]).content[0].theme, 'number');
  const table = newBlock('table');
  const t = toOzon([table]).content[0];
  assert.equal(t.widgetName, 'raTable');
  assert.deepEqual(t.table.head.map((h) => h.text[0]), ['Фасовка', 'Кусочков', 'Чашек']);
  assert.deepEqual(t.table.body[0], [['8 г'], ['15'], ['15']]);
  const v = newBlock('video'); v.youtube = 'https://youtu.be/dQw4w9WgXcQ?t=3';
  assert.deepEqual(toOzon([v]).content[0], { widgetName: 'raVideo', type: 'youtube', id: 'dQw4w9WgXcQ' });
  assert.equal(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  const btn = newBlock('text');
  btn.linkLabel = 'Задать вопрос продавцу →'; btn.linkUrl = questionsUrl('5211050462');
  const tb = toOzon([btn]).content[0];
  assert.deepEqual(tb.text.items.at(-1), { type: 'link', content: 'Задать вопрос продавцу →', href: 'https://www.ozon.ru/product/5211050462/questions/' });
  btn.linkUrl = 'https://t.me/shop';
  assert.ok(check([btn]).some((p) => p.includes('ozon.ru')));
  assert.equal(toOzon([btn]).content[0].text.items.some((i) => i.type === 'link'), false, 'чужая ссылка не уходит в JSON');
  // импорт обратно
  const back = fromOzon(toOzon([num, table, v])).blocks;
  assert.deepEqual(back.map((b) => b.type), ['numlist', 'table', 'video']);
  assert.deepEqual(back[1].rows[1], ['25 г', '50', '50']);
});
