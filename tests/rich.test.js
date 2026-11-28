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
    assert.deepEqual(kinds, ['raShowcase:billboard', 'raShowcase:chess', 'raTextBlock:primary', 'raShowcase:tileL', 'raTextBlock:secondary', 'raShowcase:tileXL', 'raTextBlock:primary', 'list:image', 'list:bullet', 'raShowcase:roll']);
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
  const num = newBlock('numlist');
  assert.equal(toOzon([num]).content[0].theme, 'number');
  const table = newBlock('table');
  const t = toOzon([table]).content[0];
  assert.equal(t.widgetName, 'raTable');
  assert.deepEqual(t.table.head.map((h) => h.text[0]), ['Фасовка', 'Кусочков', 'Чашек']);
  assert.deepEqual(t.table.body[0], [['8 г'], ['15'], ['15']]);
  const v = newBlock('video'); v.src = 'https://cdn.example.ru/tea.mp4';
  assert.deepEqual(toOzon([v]).content[0], { widgetName: 'raVideo', type: 'embedded', width: 1280, height: 720, sources: [{ type: 'video/mp4', src: 'https://cdn.example.ru/tea.mp4' }] });
  assert.ok(check([newBlock('video')]).some((p) => p.includes('.mp4')), 'пустое видео — ошибка');
  const btn = newBlock('text');
  btn.linkLabel = 'Все чаи магазина →'; btn.linkUrl = 'https://www.ozon.ru/product/5211050462/';
  const tb = toOzon([btn]).content[0];
  assert.deepEqual(tb.text.items.at(-1), { type: 'link', content: 'Все чаи магазина →', href: 'https://www.ozon.ru/product/5211050462/' });
  btn.linkUrl = 'https://t.me/shop';
  assert.ok(check([btn]).some((p) => p.includes('ozon.ru')));
  assert.equal(toOzon([btn]).content[0].text.items.some((i) => i.type === 'link'), false, 'чужая ссылка не уходит в JSON');
  // импорт обратно
  const back = fromOzon(toOzon([num, table, v])).blocks;
  assert.deepEqual(back.map((b) => b.type), ['numlist', 'table', 'video']);
  assert.deepEqual(back[1].rows[1], ['25 г', '50', '50']);
});

test('плитки: любое количество, ровные ряды', async () => {
  const { tileRows } = await import('../public/rich.js');
  const sig = (n, l) => tileRows(n, l).map((r) => `${r.type}${r.count}`).join('+');
  assert.equal(sig(3), 'tileL3');
  assert.equal(sig(4), 'tileXL4', '4 — два ряда по 2');
  assert.equal(sig(5), 'tileL3+tileXL2', '5 — 3 сверху, 2 снизу по центру');
  assert.equal(sig(6), 'tileL6', '6 — 3 под 3');
  assert.equal(sig(7), 'tileL3+tileXL4');
  assert.equal(sig(8), 'tileL6+tileXL2');
  assert.equal(sig(5, '3'), 'tileL5');
  assert.equal(sig(5, '2'), 'tileXL5');
  const b = newBlock('tiles');
  b.items = [1, 2, 3, 4, 5].map((n) => ({ title: `Чай ${n}`, text: '', sku: '5211050462', img: { src: '', srcM: '', w: 0, h: 0, wM: 0, hM: 0 } }));
  const json = toOzon([b]);
  assert.deepEqual(json.content.map((w) => `${w.type}:${w.blocks.length}`), ['tileL:3', 'tileXL:2']);
  assert.deepEqual(check([b]).filter((p) => p.includes('плит')), [], 'больше 3 плиток — не ошибка');
  // импорт обратно — снова один блок из 5 плиток
  const back = fromOzon(json).blocks;
  assert.equal(back.length, 1);
  assert.equal(back[0].items.length, 5);
  assert.equal(back[0].layout, 'auto');
  // два отдельных ряда по 3, сделанных вручную, не склеиваются
  const two = { version: 0.3, content: [json.content[0], { ...json.content[0] }] };
  assert.equal(fromOzon(two).blocks.length, 2);
});

test('профиль вкуса: таблица со шкалами, без шапки для одного чая, и обратно', async () => {
  const { scale } = await import('../public/rich.js');
  assert.equal(scale(3), '●●●○○');
  assert.equal(scale(4, 5, 'stars'), '★★★★☆');
  const b = newBlock('taste');
  const w = toOzon([b]).content[0];
  assert.equal(w.widgetName, 'raTable');
  assert.equal(w.table.hideHead, true);
  assert.deepEqual(w.table.body[0], [['💪 Крепость'], ['🟤🟤🟤🟤⚪']], 'цветная шкала и значок свойства');
  // сравнение двух чаёв — с шапкой и картинками
  b.teas = [{ name: 'Шу пуэр', img: { src: 'https://x.ru/shu.png', srcM: '', w: 300, h: 300, wM: 0, hM: 0 } }, { name: 'ГАБА', img: { src: '', srcM: '', w: 0, h: 0, wM: 0, hM: 0 } }];
  b.rows.forEach((r) => r.vals.push(1));
  const w2 = toOzon([b]).content[0];
  assert.equal(w2.table.hideHead, undefined);
  assert.equal(w2.table.head[1].img.src, 'https://x.ru/shu.png');
  assert.equal(w2.table.head[2].img, undefined);
  const back = fromOzon(toOzon([b])).blocks[0];
  assert.equal(back.type, 'taste');
  assert.deepEqual(back.teas.map((t) => t.name), ['Шу пуэр', 'ГАБА']);
  assert.deepEqual(back.rows[0], { name: 'Крепость', icon: '💪', vals: [4, 1] });
  assert.equal(back.mark, 'brown');
  assert.equal(back.teas[0].img.src, 'https://x.ru/shu.png');
});

test('таблица: картинки в шапке, без шапки, ссылки в ячейках', () => {
  const t = newBlock('table');
  t.headImg = [{ src: 'https://x.ru/a.png', srcM: '', w: 0, h: 0, wM: 0, hM: 0 }];
  t.rows[0][2] = 'смотреть [8 г](https://www.ozon.ru/product/5211050462/)';
  let w = toOzon([t]).content[0];
  assert.equal(w.table.head[0].img.src, 'https://x.ru/a.png');
  assert.deepEqual(w.table.body[0][2], { items: [{ type: 'text', content: 'смотреть ' }, { type: 'link', content: '8 г', href: 'https://www.ozon.ru/product/5211050462/' }] });
  const back = fromOzon(toOzon([t])).blocks[0];
  assert.equal(back.rows[0][2], 'смотреть [8 г](https://www.ozon.ru/product/5211050462/)');
  assert.equal(back.headImg[0].src, 'https://x.ru/a.png');
  t.hideHead = true;
  w = toOzon([t]).content[0];
  assert.equal(w.table.hideHead, true);
  assert.equal(w.table.head[0].img, undefined, 'без шапки картинки не отправляем');
  assert.equal(fromOzon(toOzon([t])).blocks[0].hideHead, true);
  t.rows[1][0] = '[чужая](https://t.me/x)';
  assert.ok(check([t]).some((p) => p.includes('не на ozon.ru')));
  assert.deepEqual(toOzon([t]).content[0].table.body[1][0], { items: [{ type: 'text', content: 'чужая' }] });
});

test('ссылки внутри обычного текста и отступы текстового блока', () => {
  const b = newBlock('text');
  b.text = 'Попробуйте [ГАБА](https://www.ozon.ru/product/5130480628/) вечером';
  b.pad = 'type1'; b.gap = 's';
  const w = toOzon([b]).content[0];
  assert.equal(w.padding, 'type1'); assert.equal(w.gapSize, 's');
  assert.deepEqual(w.text.items.map((i) => i.type), ['text', 'link', 'text']);
  const back = fromOzon(toOzon([b])).blocks[0];
  assert.equal(back.text, b.text);
  assert.equal(back.pad, 'type1'); assert.equal(back.gap, 's');
});

test('карточки со значком и плитки по 4', () => {
  const c = newBlock('cards');
  const w = toOzon([c]).content[0];
  assert.equal(w.type, 'tileSecondary');
  assert.equal(w.blocks.length, 4);
  assert.equal(fromOzon(toOzon([c])).blocks[0].type, 'cards');
  const t = newBlock('tiles'); t.layout = '4';
  t.items.push({ ...t.items[0] });
  assert.equal(toOzon([t]).content[0].type, 'tileM');
  const back = fromOzon(toOzon([t])).blocks[0];
  assert.equal(back.layout, '4'); assert.equal(back.items.length, 4);
});

test('профиль вкуса и таблица: вид плашкой и цветной картинкой', async () => {
  const { iconFor } = await import('../public/rich.js');
  assert.equal(iconFor('Сладость'), '🍯');
  assert.equal(iconFor('Что-то'), '🍵');
  const b = newBlock('taste');
  b.look = 'card';
  const w = toOzon([b]).content[0];
  assert.equal(w.widgetName, 'raTextBlock');
  assert.equal(w.theme, 'tertiary');
  assert.equal(w.text.size, 'size4', 'на плашке текст крупнее');
  assert.equal(w.text.items[0].content, '💪 Крепость   🟤🟤🟤🟤⚪');
  b.look = 'image';
  assert.ok(check([b]).some((p) => p.includes('загрузите её')), 'без ссылки на картинку — подсказка');
  b.pic = { src: 'https://cdn1.ozone.ru/s3/rich/taste.png', srcM: 'https://cdn1.ozone.ru/s3/rich/taste-m.png', w: 1416, h: 760, wM: 640, hM: 900 };
  const p = toOzon([b]).content[0];
  assert.equal(p.type, 'roll');
  assert.equal(p.blocks[0].img.srcMobile, 'https://cdn1.ozone.ru/s3/rich/taste-m.png');
  assert.match(p.blocks[0].img.alt, /Крепость 4 из 5/);
  assert.deepEqual(check([b]).filter((x) => x.includes('загрузите')), []);
  const t = newBlock('table'); t.look = 'image'; t.pic = b.pic;
  assert.equal(toOzon([t]).content[0].type, 'roll');
});

test('инфографика вкуса: 6 видов, в Ozon уходит картинкой с описанием', async () => {
  const { CHART_KINDS, chartAlt } = await import('../public/rich.js');
  assert.deepEqual(Object.keys(CHART_KINDS), ['bars', 'radar', 'sliders', 'wheel', 'map', 'notes']);
  const b = newBlock('chart');
  assert.ok(check([b]).some((p) => p.includes('загрузите её')), 'пока нет ссылки — подсказка');
  b.pic = { src: 'https://cdn1.ozone.ru/s3/rich/chart.png', srcM: '', w: 1416, h: 900, wM: 0, hM: 0 };
  const w = toOzon([b]).content[0];
  assert.equal(w.widgetName, 'raShowcase'); assert.equal(w.type, 'roll');
  assert.match(w.blocks[0].img.alt, /Крепость 4 из 5/);
  for (const k of Object.keys(CHART_KINDS)) { b.kind = k; assert.ok(chartAlt(b).length > 15, k); }
  b.kind = 'map'; assert.match(chartAlt(b), /Шу пуэр — Крепкий, Бодрит/);
});

test('одна плитка — во всю ширину; длинный текст в шахматке — не ошибка', async () => {
  const { tileRows } = await import('../public/rich.js');
  assert.deepEqual(tileRows(1), [{ type: 'billboard', count: 1 }]);
  assert.deepEqual(tileRows(1, '3'), [{ type: 'billboard', count: 1 }]);
  const t = newBlock('tiles'); t.items = [t.items[0]]; t.items[0].sku = '5211050462';
  const w = toOzon([t]).content[0];
  assert.equal(w.type, 'billboard');
  assert.equal(w.blocks[0].imgLink, 'https://www.ozon.ru/product/5211050462/');
  const back = fromOzon(toOzon([t])).blocks[0];
  assert.equal(back.type, 'tiles'); assert.equal(back.items.length, 1); assert.equal(back.items[0].sku, '5211050462');
  const c = newBlock('chess'); c.items[0].text = 'а'.repeat(800);
  assert.deepEqual(check([c]).filter((p) => p.includes('знак')), []);
});
