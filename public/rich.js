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
    case 'tiles': return { id: uid(), type, items: [1, 2, 3].map(() => ({ title: 'Название', text: 'Подпись', sku: '', img: img() })) };
    case 'roll': return { id: uid(), type, items: [{ sku: '', link: '', img: img() }] };
    case 'text': return { id: uid(), type, title: 'Заголовок раздела', text: '', theme: 'primary', linkLabel: '', linkUrl: '' };
    case 'faq': return { id: uid(), type, items: [{ q: 'Вопрос', a: 'Ответ.' }] };
    case 'numlist': return { id: uid(), type, items: [{ q: 'Шаг', a: 'Описание шага.' }, { q: 'Шаг', a: 'Описание шага.' }] };
    case 'table': return { id: uid(), type, title: 'Сколько чашек в упаковке', head: ['Фасовка', 'Кусочков', 'Чашек'], rows: [['8 г', '15', '15'], ['25 г', '50', '50']] };
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

function textObj(str, fmt, href = '') {
  const { size = 'size3', align = 'left', color = 'color1' } = fmt || {};
  const items = [];
  String(str ?? '').split('\n').forEach((line, i) => {
    if (i) items.push({ type: 'br' });
    if (href && i === 0) items.push({ type: 'link', content: line, href });
    else items.push({ type: 'text', content: line });
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
      content.push({ widgetName: 'raShowcase', type: 'tileL', blocks: b.items.map((it) => {
        const href = productUrl(it.sku);
        return {
          img: imgShowcase('tiles', it.img, it.title, 'to_the_edge'),
          imgLink: href,
          title: textObj(it.title, getStyle(b, 'title'), href),
          text: textObj(it.text, getStyle(b, 'text')),
        };
      }) });
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
      content.push({ widgetName: 'raTextBlock', theme: b.theme || 'primary', padding: 'type2', gapSize: 'm',
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
      content.push({ widgetName: 'raTable', title: textObj(b.title, getStyle(b, 'title')), table: {
        head: b.head.map((h) => ({ text: [h], contentAlign: st.align, size: st.size, color: st.color })),
        body: b.rows.map((r) => b.head.map((_, i) => [r[i] ?? ''])),
      } });
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
      out.push({ id: uid(), type: 'hero', title: readText(bl[0].title), text: readText(bl[0].text), img: readImg(bl[0].img), style: styleOf(bl[0]) });
    } else if (w.widgetName === 'raShowcase' && w.type === 'chess') {
      // Подряд идущие шахматки по одному блоку склеиваем в одну.
      const items = bl.map((x) => ({ title: readText(x.title), text: readText(x.text), img: readImg(x.img) }));
      const last = out[out.length - 1];
      if (last && last.type === 'chess' && last._merge) last.items.push(...items);
      else out.push({ id: uid(), type: 'chess', items, _merge: true, style: styleOf(bl[0]) });
    } else if (w.widgetName === 'raShowcase' && ['tileL', 'tileXL', 'tileM', 'tileSecondary'].includes(w.type)) {
      out.push({ id: uid(), type: 'tiles', style: styleOf(bl[0]), items: bl.map((x) => ({ title: readText(x.title), text: readText(x.text), sku: skuFromUrl(x.imgLink || readLink(x.title)), img: readImg(x.img) })) });
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
      out.push({ id: uid(), type: 'text', title: readText(w.title), text: readText(rest), theme: w.theme || 'primary',
        linkLabel: hasLink ? last.content : '', linkUrl: hasLink ? last.href : '', style: styleOf(w) });
    } else if (w.widgetName === 'list' && w.theme === 'image') {
      out.push({ id: uid(), type: 'catalog', style: styleOf(bl[0]), items: bl.map((x) => ({ title: readText(x.title), sku: skuFromUrl(readLink(x.title) || x.imgLink), text: readText(x.text), img: readImg(x.img) })) });
    } else if (w.widgetName === 'list') {
      out.push({ id: uid(), type: w.theme === 'number' ? 'numlist' : 'faq', style: styleOf(bl[0]), items: bl.map((x) => ({ q: readText(x.title), a: readText(x.text) })) });
    } else if (w.widgetName === 'raTable' && w.table) {
      const cell = (c) => (Array.isArray(c) ? c.join('\n') : readText(c));
      const head = (w.table.head || []).map((h) => (Array.isArray(h.text) ? h.text.map((x) => (typeof x === 'string' ? x : x.content || '')).join('') : ''));
      out.push({ id: uid(), type: 'table', title: readText(w.title), head, rows: (w.table.body || []).map((r) => r.map(cell)), style: { title: fmtOf(w.title) } });
    } else if (w.widgetName === 'raVideo') {
      // Ролики YouTube не переносим: в России они у покупателей не грузятся (решение Марка 27.11.2026).
      out.push({ id: uid(), type: 'video', src: w.type === 'youtube' ? '' : ((w.sources || [])[0] || {}).src || '', w: w.width || 1280, h: w.height || 720 });
    } else {
      skipped.push(w.widgetName + (w.type ? `:${w.type}` : ''));
    }
  }
  out.forEach((b) => delete b._merge);
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
    list.forEach((img) => { const r = resolveImage(b.type, img); imgs.push([where, r.src], [where, r.srcM]); });
    if (b.type === 'chess' && (b.items.length < 2 || b.items.length > 6)) problems.push(`${where}: нужно от 2 до 6 блоков, сейчас ${b.items.length}`);
    if (b.type === 'chess') b.items.forEach((it, i) => { if ((it.text || '').length > 260) problems.push(`${where}, блок ${i + 1}: текст длиннее 260 знаков, на телефоне это простыня`); });
    if (b.type === 'tiles' && b.items.length > 3) problems.push(`${where}: в ряд помещается не больше 3 плиток`);
    if (['tiles', 'catalog'].includes(b.type)) b.items.forEach((it) => { if (!productUrl(it.sku)) noSku.push(it.title || 'без названия'); });
    if (b.type === 'roll') b.items.forEach((it, i) => { if (it.link && !isOzonUrl(it.link)) problems.push(`${where}, картинка ${i + 1}: ссылка ведёт не на ozon.ru, Ozon такие запрещает`); });
    if (b.type === 'text' && (b.linkLabel || b.linkUrl) && !(b.linkLabel && isOzonUrl(b.linkUrl))) problems.push(`${where}: у кнопки-ссылки нужны и подпись, и адрес на ozon.ru`);
    if (b.type === 'table' && (!b.head.length || !b.rows.length)) problems.push(`${where}: в таблице нужны столбцы и хотя бы одна строка`);
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
