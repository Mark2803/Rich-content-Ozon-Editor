// Модель rich-контента и перевод в JSON Ozon (версия 0.3) и обратно.
// Один и тот же блок описывает и вид для ПК, и вид для телефона:
// картинка для телефона берётся из картинки для ПК, если своей нет, и наоборот.
// Набор полей сверен с официальной схемой Ozon https://st.ozone.ru/s3/artifact/schema.json
// и с живыми карточками (ноябрь 2026). Шрифт Ozon свой (GT Eesti) и не меняется;
// у текста есть только размер (size1–size7), цвет (color1–color4) и выравнивание.

export const TYPES = {
  hero: 'Обложка',
  chess: 'Шахматка',
  tiles: 'Плитки со ссылками',
  roll: 'Картинки во всю ширину',
  text: 'Заголовок и текст',
  faq: 'Вопросы и ответы',
  catalog: 'Витрина магазина',
  numlist: 'Нумерованный список',
  table: 'Таблица',
  taste: 'Профиль вкуса',
  cards: 'Карточки со значком',
  video: 'Видео',
};

// Размеры и цвета текста Ozon — сняты в песочнице rich-content.ozon.ru 27.11.2026.
export const SIZES = { size1: 12, size2: 14, size3: 16, size4: 20, size5: 24, size6: 30, size7: 38 };
export const COLORS = {
  color1: { hex: '#001a34', name: 'Основной' },
  color2: { hex: '#3d5165', name: 'Приглушённый' },
  color3: { hex: '#808d9a', name: 'Серый' },
  color4: { hex: '#ffffff', name: 'Белый (на картинке)' },
};
export const THEMES = {
  default: { bg: '#ffffff', name: 'Без фона' },
  primary: { bg: '#ebf5ff', name: 'Голубой' },
  secondary: { bg: '#ffffff', name: 'Белый' },
  tertiary: { bg: '#eff3f6', name: 'Серый' },
};

const DS = (ts, ta, xs, xa) => ({ title: { size: ts, color: 'color1', align: ta }, text: { size: xs, color: 'color1', align: xa } });
export const DEFAULT_STYLE = {
  hero: DS('size5', 'center', 'size3', 'center'),
  chess: DS('size4', 'left', 'size3', 'left'),
  tiles: DS('size4', 'center', 'size3', 'center'),
  roll: DS('size4', 'left', 'size3', 'left'),
  text: DS('size5', 'center', 'size3', 'center'),
  faq: DS('size4', 'left', 'size3', 'left'),
  numlist: DS('size4', 'left', 'size3', 'left'),
  catalog: DS('size4', 'left', 'size3', 'left'),
  table: DS('size4', 'left', 'size3', 'left'),
  taste: DS('size4', 'left', 'size3', 'left'),
  cards: DS('size3', 'center', 'size2', 'center'),
  video: DS('size4', 'left', 'size3', 'left'),
};
export const getStyle = (b, which) => ({ ...DEFAULT_STYLE[b.type][which], ...((b.style || {})[which] || {}) });

// Размеры по умолчанию, пока картинка не загрузилась и её размер неизвестен.
export const DEFAULT_SIZE = {
  hero: { pc: [1416, 708], m: [640, 800] },
  chess: { pc: [1000, 800], m: [640, 640] },
  tiles: { pc: [640, 640], m: [640, 640] },
  roll: { pc: [1416, 600], m: [640, 640] },
  catalog: { pc: [1000, 1000], m: [1000, 1000] },
  cards: { pc: [200, 200], m: [200, 200] },
  thead: { pc: [300, 300], m: [300, 300] },
};

// Шкалы для профиля вкуса: полный и пустой значок.
export const MARKS = { dots: ['●', '○'], stars: ['★', '☆'], squares: ['■', '□'] };
export const scale = (v, max = 5, mark = 'dots') => {
  const [on, off] = MARKS[mark] || MARKS.dots;
  const n = Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  return on.repeat(n) + off.repeat(max - n);
};

export const productUrl = (sku) => (/^\d{5,}$/.test(String(sku || '').trim()) ? `https://www.ozon.ru/product/${String(sku).trim()}/` : '');

let seq = 0;
export const uid = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

export const emptyImage = () => ({ src: '', srcM: '', w: 0, h: 0, wM: 0, hM: 0 });

export function newBlock(type) {
  const img = emptyImage;
  switch (type) {
    case 'hero': return { id: uid(), type, title: 'Заголовок', text: 'Короткий текст под заголовком.', img: img() };
    case 'chess': return { id: uid(), type, items: [1, 2].map(() => ({ title: 'Заголовок', text: 'Текст до 260 знаков: на телефоне он идёт под картинкой.', img: img() })) };
    case 'tiles': return { id: uid(), type, layout: 'auto', items: [1, 2, 3].map(() => ({ title: 'Название', text: 'Подпись', sku: '', img: img() })) };
    case 'roll': return { id: uid(), type, items: [{ sku: '', link: '', img: img() }] };
    case 'text': return { id: uid(), type, title: 'Заголовок раздела', text: '', theme: 'primary', linkLabel: '', linkUrl: '' };
    case 'faq': return { id: uid(), type, items: [{ q: 'Вопрос', a: 'Ответ.' }] };
    case 'numlist': return { id: uid(), type, items: [{ q: 'Шаг', a: 'Описание шага.' }, { q: 'Шаг', a: 'Описание шага.' }] };
    case 'table': return { id: uid(), type, title: 'Сколько чашек в упаковке', head: ['Фасовка', 'Кусочков', 'Чашек'], headImg: [], hideHead: false, rows: [['8 г', '15', '15'], ['25 г', '50', '50']] };
    case 'taste': return { id: uid(), type, title: 'Профиль вкуса', mark: 'dots', max: 5,
      teas: [{ name: '', img: img() }],
      rows: [['Крепость', 4], ['Терпкость', 2], ['Сладость', 3], ['Бодрость', 4]].map(([name, v]) => ({ name, vals: [v] })) };
    case 'cards': return { id: uid(), type, items: [['Бодрит', 'как чашка крепкого чая'], ['2 минуты', 'без чайника и сита'], ['Без сахара', '100% чай'], ['3 года', 'срок хранения']].map(([title, text]) => ({ title, text, sku: '', img: img() })) };
    case 'video': return { id: uid(), type, src: '', w: 1280, h: 720 };
    case 'catalog': return { id: uid(), type, items: [{ title: 'Название чая', sku: '', text: 'Одна строка о вкусе.', img: img() }] };
    default: throw new Error(`Неизвестный тип блока: ${type}`);
  }
}

// ---------- Синхронизация ПК и телефона ----------

// Итоговые адреса и размеры с учётом подстановки: чего нет у одной версии — берём у другой.
export function resolveImage(type, img = {}) {
  const def = DEFAULT_SIZE[type] || DEFAULT_SIZE.tiles;
  const src = img.src || img.srcM || '';
  const srcM = img.srcM || img.src || '';
  const own = (w, h, d) => (w && h ? [w, h] : d);
  const [w, h] = img.src ? own(img.w, img.h, def.pc) : own(img.wM, img.hM, def.pc);
  const [wM, hM] = img.srcM ? own(img.wM, img.hM, def.m) : own(img.w, img.h, def.m);
  return { src, srcM, w, h, wM, hM, mobileOwn: Boolean(img.srcM && img.src && img.srcM !== img.src) };
}

// ---------- Текст ----------

// Ссылка внутри текста пишется так: [подпись](https://www.ozon.ru/…).
// Ссылки не на ozon.ru Ozon запрещает — такие уходят обычным текстом (проверка их подсвечивает).
export const LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;
function lineItems(line) {
  const items = [];
  let last = 0;
  for (const m of line.matchAll(LINK_RE)) {
    if (m.index > last) items.push({ type: 'text', content: line.slice(last, m.index) });
    items.push(isOzonUrl(m[2]) ? { type: 'link', content: m[1], href: m[2] } : { type: 'text', content: m[1] });
    last = m.index + m[0].length;
  }
  if (last < line.length || !items.length) items.push({ type: 'text', content: line.slice(last) });
  return items;
}
export const hasLinks = (s) => /\[[^\]\n]+\]\(https?:\/\//.test(String(s || ''));
export const badLinks = (s) => [...String(s || '').matchAll(LINK_RE)].filter((m) => !isOzonUrl(m[2])).map((m) => m[2]);

function textObj(str, fmt, href = '') {
  const { size = 'size3', align = 'left', color = 'color1' } = fmt || {};
  const items = [];
  String(str ?? '').split('\n').forEach((line, i) => {
    if (i) items.push({ type: 'br' });
    if (href && i === 0) items.push({ type: 'link', content: line, href });
    else items.push(...lineItems(line));
  });
  return { size, align, color, items };
}
const fmtOf = (t) => (t ? { size: t.size, color: t.color, align: t.align } : {});

export function readText(t) {
  if (!t) return '';
  if (Array.isArray(t.items)) {
    return t.items.map((it) => (it.type === 'br' ? '\n' : it.content ?? '')).join('');
  }
  if (Array.isArray(t.content)) return t.content.join('\n');
  return '';
}

// То же, но ссылки внутри текста сохраняются как [подпись](адрес).
export function readRich(t) {
  if (!t || !Array.isArray(t.items)) return readText(t);
  return t.items.map((it) => (it.type === 'br' ? '\n' : it.type === 'link' ? `[${it.content ?? ''}](${it.href || ''})` : it.content ?? '')).join('');
}

const readLink = (t) => (t && Array.isArray(t.items) ? (t.items.find((i) => i.type === 'link') || {}).href || '' : '');
const skuFromUrl = (u) => (String(u || '').match(/ozon\.ru\/product\/(?:[^/]*-)?(\d{5,})\/?/) || [])[1] || '';

// ---------- Экспорт в JSON Ozon ----------

function imgShowcase(type, img, alt, position) {
  const r = resolveImage(type, img);
  return {
    src: r.src, srcMobile: r.srcM, alt: alt || '',
    widthMobile: r.wM, heightMobile: r.hM,
    position, positionMobile: position,
    isParandja: false, isParandjaMobile: false,
  };
}

// Картинка в шапке таблицы (Ozon показывает её 96×96).
function imgHead(img, alt) {
  const r = resolveImage('thead', img);
  return { src: r.src, srcMobile: r.srcM, alt: alt || '', widthMobile: r.wM, heightMobile: r.hM, position: 'to_the_edge', positionMobile: 'to_the_edge' };
}
const cellOut = (s) => (hasLinks(s) ? { items: textObj(s).items } : String(s ?? '').split('\n'));

// Раскладка плиток. Проверено в песочнице Ozon 28.11.2026: tileL ставит по 3 в ряд,
// лишние уходят на следующий ряд и прижимаются влево (по центру Ozon не ставит);
// tileXL — по 2 в ряд, каждая на половину ширины. На телефоне любые плитки идут по одной в ряд.
// «Авто»: 4 → 2+2, 5 → 3+2, 6 → 3+3, 7 → 3+2+2; неполный ряд из двух делаем крупными
// плитками на всю ширину, чтобы он стоял ровно по центру, а не прижимался влево.
// tileM — по 4 в ряд, мелкие (проверено 28.11.2026; на телефоне тоже по одной).
export const TILE_LAYOUTS = { auto: 'Авто: ровные ряды', 3: 'Все по 3 в ряд', 2: 'Все по 2 в ряд, крупные', 4: 'Все по 4 в ряд, мелкие' };
export function tileRows(n, layout = 'auto') {
  if (n <= 0) return [];
  if (layout === '4' || layout === 4) return [{ type: 'tileM', count: n }];
  if (layout === '3' || layout === 3) return [{ type: 'tileL', count: n }];
  if (layout === '2' || layout === 2) return [{ type: 'tileXL', count: n }];
  if (n === 2 || n === 4) return [{ type: 'tileXL', count: n }];
  if (n % 3 === 0 || n === 1) return [{ type: 'tileL', count: n }];
  if (n % 3 === 2) return [{ type: 'tileL', count: n - 2 }, { type: 'tileXL', count: 2 }];
  return [{ type: 'tileL', count: n - 4 }, { type: 'tileXL', count: 4 }];
}

export function toOzon(blocks) {
  const content = [];
  for (const b of blocks) {
    if (b.type === 'hero') {
      const r = resolveImage('hero', b.img);
      content.push({ widgetName: 'raShowcase', type: 'billboard', blocks: [{
        img: { src: r.src, srcMobile: r.srcM, alt: b.title || '', width: r.w, height: r.h, widthMobile: r.wM, heightMobile: r.hM },
        imgLink: '',
        title: textObj(b.title, getStyle(b, 'title')),
        text: textObj(b.text, getStyle(b, 'text')),
      }] });
    } else if (b.type === 'chess') {
      content.push({ widgetName: 'raShowcase', type: 'chess', blocks: b.items.map((it, i) => ({
        img: imgShowcase('chess', it.img, it.title, 'fill'),
        imgLink: '',
        reverse: i % 2 === 1,
        title: textObj(it.title, getStyle(b, 'title')),
        text: textObj(it.text, getStyle(b, 'text')),
      })) });
    } else if (b.type === 'tiles') {
      const tile = (it) => {
        const href = productUrl(it.sku);
        return {
          img: imgShowcase('tiles', it.img, it.title, 'to_the_edge'),
          imgLink: href,
          title: textObj(it.title, getStyle(b, 'title'), href),
          text: textObj(it.text, getStyle(b, 'text')),
        };
      };
      // Плитки раскладываются на ряды: tileL — по 3 в ряд, tileXL — по 2 (крупнее).
      let from = 0;
      for (const row of tileRows(b.items.length, b.layout)) {
        content.push({ widgetName: 'raShowcase', type: row.type, blocks: b.items.slice(from, from + row.count).map(tile) });
        from += row.count;
      }
    } else if (b.type === 'roll') {
      content.push({ widgetName: 'raShowcase', type: 'roll', blocks: b.items.map((it) => ({
        img: imgShowcase('roll', it.img, it.alt || '', 'width_full'),
        imgLink: productUrl(it.sku) || (isOzonUrl(it.link) ? it.link : ''),
      })) });
    } else if (b.type === 'text') {
      const text = textObj(b.text || '', getStyle(b, 'text'));
      const href = isOzonUrl(b.linkUrl) ? b.linkUrl : '';
      if (b.linkLabel && href) {
        if (text.items.length && !(text.items.length === 1 && !text.items[0].content)) text.items.push({ type: 'br' });
        else text.items = [];
        text.items.push({ type: 'link', content: b.linkLabel, href });
      }
      content.push({ widgetName: 'raTextBlock', theme: b.theme || 'primary', padding: b.pad === 'type1' ? 'type1' : 'type2', gapSize: b.gap === 's' ? 's' : 'm',
        title: textObj(b.title, getStyle(b, 'title')), text });
    } else if (b.type === 'faq' || b.type === 'numlist') {
      content.push({ widgetName: 'list', theme: b.type === 'faq' ? 'bullet' : 'number',
        blocks: b.items.map((it) => ({ title: textObj(it.q, getStyle(b, 'title')), text: textObj(it.a, getStyle(b, 'text')) })) });
    } else if (b.type === 'catalog') {
      content.push({ widgetName: 'list', theme: 'image', blocks: b.items.map((it) => ({
        img: imgShowcase('catalog', it.img, it.title, 'to_the_edge'),
        title: textObj(it.title, getStyle(b, 'title'), productUrl(it.sku)),
        text: textObj(it.text, getStyle(b, 'text')),
      })) });
    } else if (b.type === 'table') {
      const st = getStyle(b, 'text');
      const table = {
        head: b.head.map((h, i) => {
          const cell = { text: [h], contentAlign: st.align, size: st.size, color: st.color };
          const im = (b.headImg || [])[i];
          if (!b.hideHead && im && (im.src || im.srcM)) cell.img = imgHead(im, h);
          return cell;
        }),
        body: b.rows.map((r) => b.head.map((_, i) => cellOut(r[i] ?? ''))),
      };
      if (b.hideHead) table.hideHead = true;
      content.push({ widgetName: 'raTable', title: textObj(b.title, getStyle(b, 'title')), table });
    } else if (b.type === 'taste') {
      // Профиль вкуса — таблица: строки «Крепость ●●●●○», столбцы — чаи.
      const st = getStyle(b, 'text');
      const showHead = b.teas.length > 1 || b.teas.some((t) => t.name || (t.img && (t.img.src || t.img.srcM)));
      const head = [{ text: [''] }, ...b.teas.map((t) => {
        const cell = { text: [t.name || ''], contentAlign: 'center', size: st.size, color: st.color };
        if (showHead && t.img && (t.img.src || t.img.srcM)) cell.img = imgHead(t.img, t.name);
        return cell;
      })];
      const table = { head, body: b.rows.map((r) => [[r.name], ...b.teas.map((_, i) => [scale(r.vals[i], b.max, b.mark)])]) };
      if (!showHead) table.hideHead = true;
      content.push({ widgetName: 'raTable', title: textObj(b.title, getStyle(b, 'title')), table });
    } else if (b.type === 'cards') {
      // Карточки со значком (tileSecondary): серые карточки, значок 50 px сверху, на ПК по 4 в ряд, на телефоне по 2.
      content.push({ widgetName: 'raShowcase', type: 'tileSecondary', blocks: b.items.map((it) => {
        const href = productUrl(it.sku);
        return { img: imgShowcase('cards', it.img, it.title, 'to_the_edge'), imgLink: href,
          title: textObj(it.title, getStyle(b, 'title'), href), text: textObj(it.text, getStyle(b, 'text')) };
      }) });
    } else if (b.type === 'video') {
      content.push({ widgetName: 'raVideo', type: 'embedded', width: Number(b.w) || 1280, height: Number(b.h) || 720,
        sources: [{ type: videoMime(b.src), src: b.src }] });
    }
  }
  return { content, version: 0.3 };
}

export const isOzonUrl = (u) => /^https:\/\/(www\.)?ozon\.ru\//.test(String(u || ''));
const MIME = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', ogg: 'video/ogg', mpeg: 'video/mpeg', '3gp': 'video/3gpp' };
export const videoMime = (src) => MIME[(String(src).split('?')[0].split('.').pop() || '').toLowerCase()] || 'video/mp4';

// ---------- Импорт из JSON Ozon ----------

function readImg(img = {}) {
  const src = img.src || '';
  const mob = img.srcMobile || '';
  if (mob && mob !== src) {
    return { src, srcM: mob, w: img.width || 0, h: img.height || 0, wM: img.widthMobile || 0, hM: img.heightMobile || 0 };
  }
  // Одна картинка на оба вида: её размер известен из полей для телефона.
  return { src: src || mob, srcM: '', w: img.width || img.widthMobile || 0, h: img.height || img.heightMobile || 0, wM: 0, hM: 0 };
}

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v));
function styleOf(x) {
  if (!x) return {};
  const st = {};
  if (x.title) st.title = clean(fmtOf(x.title));
  if (x.text) st.text = clean(fmtOf(x.text));
  return st;
}

export function fromOzon(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data || !Array.isArray(data.content)) throw new Error('В коде нет списка блоков «content». Это не rich-контент Ozon.');
  const out = [];
  const skipped = [];
  for (const w of data.content) {
    const bl = Array.isArray(w.blocks) ? w.blocks : [];
    if (w.widgetName === 'raShowcase' && w.type === 'billboard' && bl[0]) {
      out.push({ id: uid(), type: 'hero', title: readRich(bl[0].title), text: readRich(bl[0].text), img: readImg(bl[0].img), style: styleOf(bl[0]) });
    } else if (w.widgetName === 'raShowcase' && w.type === 'chess') {
      // Подряд идущие шахматки по одному блоку склеиваем в одну.
      const items = bl.map((x) => ({ title: readRich(x.title), text: readRich(x.text), img: readImg(x.img) }));
      const last = out[out.length - 1];
      if (last && last.type === 'chess' && last._merge) last.items.push(...items);
      else out.push({ id: uid(), type: 'chess', items, _merge: true, style: styleOf(bl[0]) });
    } else if (w.widgetName === 'raShowcase' && w.type === 'tileSecondary') {
      out.push({ id: uid(), type: 'cards', style: styleOf(bl[0]), items: bl.map((x) => ({ title: readText(x.title), text: readRich(x.text), sku: skuFromUrl(x.imgLink || readLink(x.title)), img: readImg(x.img) })) });
    } else if (w.widgetName === 'raShowcase' && w.type === 'tileM') {
      out.push({ id: uid(), type: 'tiles', layout: '4', style: styleOf(bl[0]), items: bl.map((x) => ({ title: readText(x.title), text: readRich(x.text), sku: skuFromUrl(x.imgLink || readLink(x.title)), img: readImg(x.img) })) });
    } else if (w.widgetName === 'raShowcase' && ['tileL', 'tileXL'].includes(w.type)) {
      const items = bl.map((x) => ({ title: readText(x.title), text: readText(x.text), sku: skuFromUrl(x.imgLink || readLink(x.title)), img: readImg(x.img) }));
      const kind = w.type === 'tileXL' ? 'tileXL' : 'tileL';
      const same = (rows, n) => JSON.stringify(rows) === JSON.stringify(tileRows(n, 'auto'));
      const last = out[out.length - 1];
      // Ряды, которые редактор сам разложил («Авто»), при импорте снова собираем в один блок.
      const rows = last && last.type === 'tiles' && last._rows ? [...last._rows, { type: kind, count: items.length }] : null;
      if (rows && same(rows, last.items.length + items.length)) {
        last.items.push(...items); last._rows = rows; last.layout = 'auto';
      } else {
        const one = [{ type: kind, count: items.length }];
        out.push({ id: uid(), type: 'tiles', style: styleOf(bl[0]), items, _rows: one,
          layout: same(one, items.length) ? 'auto' : (kind === 'tileXL' ? '2' : '3') });
      }
    } else if (w.widgetName === 'raShowcase' && w.type === 'roll') {
      const items = bl.map((x) => ({ sku: skuFromUrl(x.imgLink), link: skuFromUrl(x.imgLink) ? '' : x.imgLink || '', alt: (x.img || {}).alt || '', img: readImg(x.img) }));
      const last = out[out.length - 1];
      if (last && last.type === 'roll' && last._merge) last.items.push(...items);
      else out.push({ id: uid(), type: 'roll', items, _merge: true });
    } else if (w.widgetName === 'raTextBlock') {
      // Ссылку в конце текста выносим в отдельные поля, остальное — текст.
      const items = (w.text && w.text.items) || [];
      const last = items[items.length - 1];
      const hasLink = last && last.type === 'link';
      const rest = hasLink ? { ...w.text, items: items.slice(0, -1).filter((it, i, a) => !(i === a.length - 1 && it.type === 'br')) } : w.text;
      out.push({ id: uid(), type: 'text', title: readRich(w.title), text: readRich(rest), theme: w.theme || 'primary',
        pad: w.padding === 'type1' ? 'type1' : 'type2', gap: w.gapSize === 's' ? 's' : 'm',
        linkLabel: hasLink ? last.content : '', linkUrl: hasLink ? last.href : '', style: styleOf(w) });
    } else if (w.widgetName === 'list' && w.theme === 'image') {
      out.push({ id: uid(), type: 'catalog', style: styleOf(bl[0]), items: bl.map((x) => ({ title: readText(x.title), sku: skuFromUrl(readLink(x.title) || x.imgLink), text: readText(x.text), img: readImg(x.img) })) });
    } else if (w.widgetName === 'list') {
      out.push({ id: uid(), type: w.theme === 'number' ? 'numlist' : 'faq', style: styleOf(bl[0]), items: bl.map((x) => ({ q: readRich(x.title), a: readRich(x.text) })) });
    } else if (w.widgetName === 'raTable' && w.table) {
      const cell = (c) => (Array.isArray(c) ? c.join('\n') : readRich(c));
      const headCells = w.table.head || [];
      const head = headCells.map((h) => (Array.isArray(h.text) ? h.text.map((x) => (typeof x === 'string' ? x : x.content || '')).join('') : ''));
      const headImg = headCells.map((h) => (h.img ? readImg(h.img) : emptyImage()));
      const rows = (w.table.body || []).map((r) => r.map(cell));
      const st = { title: clean(fmtOf(w.title)), text: clean(fmtOf(headCells[1] || headCells[0])) };
      // Таблица, где во всех ячейках кроме первого столбца шкалы ●●●○○, — это профиль вкуса.
      const markOf = (s) => Object.entries(MARKS).find(([, [on, off]]) => new RegExp(`^[${on}${off}]+$`).test(s));
      const taste = rows.length && head.length > 1 && rows.every((r) => r.length === head.length && r.slice(1).every((c) => markOf(c)));
      if (taste) {
        const mark = markOf(rows[0][1])[0];
        const [on] = MARKS[mark];
        out.push({ id: uid(), type: 'taste', title: readText(w.title), mark, max: rows[0][1].length,
          teas: head.slice(1).map((name, i) => ({ name, img: headImg[i + 1] })),
          rows: rows.map((r) => ({ name: r[0], vals: r.slice(1).map((c) => [...c].filter((ch) => ch === on).length) })), style: st });
      } else {
        out.push({ id: uid(), type: 'table', title: readText(w.title), head, headImg, hideHead: Boolean(w.table.hideHead), rows, style: st });
      }
    } else if (w.widgetName === 'raVideo') {
      // Ролики YouTube не переносим: в России они у покупателей не грузятся (решение Марка 27.11.2026).
      out.push({ id: uid(), type: 'video', src: w.type === 'youtube' ? '' : ((w.sources || [])[0] || {}).src || '', w: w.width || 1280, h: w.height || 720 });
    } else {
      skipped.push(w.widgetName + (w.type ? `:${w.type}` : ''));
    }
  }
  out.forEach((b) => { delete b._merge; delete b._rows; });
  return { blocks: out, skipped };
}

// ---------- Проверка перед вставкой в Ozon ----------

const IMG_RE = /^https:\/\/\S+\.(jpe?g|jpe|png)$/i;

export function check(blocks) {
  const problems = [];
  const imgs = [];
  const noSku = [];
  blocks.forEach((b, n) => {
    const where = `${n + 1}. ${TYPES[b.type]}`;
    const list = b.img ? [b.img] : (b.items || []).map((i) => i.img).filter(Boolean);
    if (b.type === 'cards' && b.items.length < 1) problems.push(`${where}: добавьте хотя бы одну карточку`);
    list.forEach((img) => { const r = resolveImage(b.type, img); imgs.push([where, r.src], [where, r.srcM]); });
    if (b.type === 'chess' && (b.items.length < 2 || b.items.length > 6)) problems.push(`${where}: нужно от 2 до 6 блоков, сейчас ${b.items.length}`);
    if (b.type === 'chess') b.items.forEach((it, i) => { if ((it.text || '').length > 260) problems.push(`${where}, блок ${i + 1}: текст длиннее 260 знаков, на телефоне это простыня`); });
    if (['tiles', 'catalog'].includes(b.type)) b.items.forEach((it) => { if (!productUrl(it.sku)) noSku.push(it.title || 'без названия'); });
    if (b.type === 'roll') b.items.forEach((it, i) => { if (it.link && !isOzonUrl(it.link)) problems.push(`${where}, картинка ${i + 1}: ссылка ведёт не на ozon.ru, Ozon такие запрещает`); });
    if (b.type === 'text' && (b.linkLabel || b.linkUrl) && !(b.linkLabel && isOzonUrl(b.linkUrl))) problems.push(`${where}: у кнопки-ссылки нужны и подпись, и адрес на ozon.ru`);
    if (b.type === 'table' && (!b.head.length || !b.rows.length)) problems.push(`${where}: в таблице нужны столбцы и хотя бы одна строка`);
    if (b.type === 'table' && !b.hideHead) (b.headImg || []).forEach((im) => { if (im && (im.src || im.srcM)) { const r = resolveImage('thead', im); imgs.push([where, r.src], [where, r.srcM]); } });
    if (b.type === 'taste') {
      if (!b.teas.length || !b.rows.length) problems.push(`${where}: нужен хотя бы один чай и одна строка`);
      b.teas.forEach((t) => { if (t.img && (t.img.src || t.img.srcM)) { const r = resolveImage('thead', t.img); imgs.push([where, r.src], [where, r.srcM]); } });
    }
    // Ссылки внутри текста — только на ozon.ru.
    const texts = [];
    const walk = (o) => { if (typeof o === 'string') texts.push(o); else if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (!['img', 'headImg', 'id', 'type', 'style', 'linkUrl', 'link', 'src'].includes(k)) walk(v); };
    walk(b);
    const bad = texts.flatMap(badLinks);
    if (bad.length) problems.push(`${where}: ссылка ведёт не на ozon.ru, Ozon такие запрещает — уйдёт обычным текстом (${bad[0]})`);
    if (b.type === 'video' && !/^https:\/\/\S+\.(mp4|webm|mov|ogg|mpeg|3gp)(\?\S*)?$/i.test(b.src || '')) problems.push(`${where}: нужна прямая ссылка на видеофайл .mp4`);
  });
  const empty = imgs.filter(([, u]) => !u);
  const bad = imgs.filter(([, u]) => u && !IMG_RE.test(u));
  if (empty.length) problems.push(`Нет картинки: ${[...new Set(empty.map(([w]) => w))].join(', ')}`);
  if (bad.length) problems.push(`Адрес картинки должен начинаться с https:// и заканчиваться на .jpg, .jpeg или .png: ${[...new Set(bad.map(([w]) => w))].join(', ')}`);
  if (noSku.length) problems.push(`Без SKU, ссылки не будет: ${noSku.join(', ')}`);
  if (!blocks.length) problems.push('Добавьте хотя бы один блок');
  return problems;
}
