// Модель rich-контента и перевод в JSON Ozon (версия 0.3) и обратно.
// Один и тот же блок описывает и вид для ПК, и вид для телефона:
// картинка для телефона берётся из картинки для ПК, если своей нет, и наоборот.
// Набор полей каждого виджета скопирован с живых карточек Ozon (ноябрь 2026).

export const TYPES = {
  hero: 'Обложка',
  chess: 'Шахматка',
  tiles: 'Плитки со ссылками',
  roll: 'Картинки во всю ширину',
  text: 'Заголовок и текст',
  faq: 'Вопросы и ответы',
  catalog: 'Витрина магазина',
};

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
    case 'text': return { id: uid(), type, title: 'Заголовок раздела', text: '', theme: 'primary' };
    case 'faq': return { id: uid(), type, items: [{ q: 'Вопрос', a: 'Ответ.' }] };
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

function textObj(str, size = 'size3', align = 'left', href = '') {
  const items = [];
  String(str ?? '').split('\n').forEach((line, i) => {
    if (i) items.push({ type: 'br' });
    if (href && i === 0) items.push({ type: 'link', content: line, href });
    else items.push({ type: 'text', content: line });
  });
  return { size, align, color: 'color1', items };
}

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
        title: textObj(b.title, 'size5', 'center'),
        text: textObj(b.text, 'size3', 'center'),
      }] });
    } else if (b.type === 'chess') {
      content.push({ widgetName: 'raShowcase', type: 'chess', blocks: b.items.map((it, i) => ({
        img: imgShowcase('chess', it.img, it.title, 'fill'),
        imgLink: '',
        reverse: i % 2 === 1,
        title: textObj(it.title, 'size4'),
        text: textObj(it.text),
      })) });
    } else if (b.type === 'tiles') {
      content.push({ widgetName: 'raShowcase', type: 'tileL', blocks: b.items.map((it) => {
        const href = productUrl(it.sku);
        return {
          img: imgShowcase('tiles', it.img, it.title, 'to_the_edge'),
          imgLink: href,
          title: textObj(it.title, 'size4', 'center', href),
          text: textObj(it.text, 'size3', 'center'),
        };
      }) });
    } else if (b.type === 'roll') {
      content.push({ widgetName: 'raShowcase', type: 'roll', blocks: b.items.map((it) => ({
        img: imgShowcase('roll', it.img, it.alt || '', 'width_full'),
        imgLink: productUrl(it.sku) || (isOzonUrl(it.link) ? it.link : ''),
      })) });
    } else if (b.type === 'text') {
      content.push({ widgetName: 'raTextBlock', theme: b.theme || 'primary', padding: 'type2', gapSize: 'm',
        title: textObj(b.title, 'size5', 'center'), text: textObj(b.text || '', 'size3', 'center') });
    } else if (b.type === 'faq') {
      content.push({ widgetName: 'list', theme: 'bullet', blocks: b.items.map((it) => ({ title: textObj(it.q, 'size4'), text: textObj(it.a) })) });
    } else if (b.type === 'catalog') {
      content.push({ widgetName: 'list', theme: 'image', blocks: b.items.map((it) => ({
        img: imgShowcase('catalog', it.img, it.title, 'to_the_edge'),
        title: textObj(it.title, 'size4', 'left', productUrl(it.sku)),
        text: textObj(it.text),
      })) });
    }
  }
  return { content, version: 0.3 };
}

export const isOzonUrl = (u) => /^https:\/\/(www\.)?ozon\.ru\//.test(String(u || ''));

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

export function fromOzon(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data || !Array.isArray(data.content)) throw new Error('В коде нет списка блоков «content». Это не rich-контент Ozon.');
  const out = [];
  const skipped = [];
  for (const w of data.content) {
    const bl = Array.isArray(w.blocks) ? w.blocks : [];
    if (w.widgetName === 'raShowcase' && w.type === 'billboard' && bl[0]) {
      out.push({ id: uid(), type: 'hero', title: readText(bl[0].title), text: readText(bl[0].text), img: readImg(bl[0].img) });
    } else if (w.widgetName === 'raShowcase' && w.type === 'chess') {
      // Подряд идущие шахматки по одному блоку склеиваем в одну.
      const items = bl.map((x) => ({ title: readText(x.title), text: readText(x.text), img: readImg(x.img) }));
      const last = out[out.length - 1];
      if (last && last.type === 'chess' && last._merge) last.items.push(...items);
      else out.push({ id: uid(), type: 'chess', items, _merge: true });
    } else if (w.widgetName === 'raShowcase' && ['tileL', 'tileXL', 'tileM', 'tileSecondary'].includes(w.type)) {
      out.push({ id: uid(), type: 'tiles', items: bl.map((x) => ({ title: readText(x.title), text: readText(x.text), sku: skuFromUrl(x.imgLink || readLink(x.title)), img: readImg(x.img) })) });
    } else if (w.widgetName === 'raShowcase' && w.type === 'roll') {
      const items = bl.map((x) => ({ sku: skuFromUrl(x.imgLink), link: skuFromUrl(x.imgLink) ? '' : x.imgLink || '', alt: (x.img || {}).alt || '', img: readImg(x.img) }));
      const last = out[out.length - 1];
      if (last && last.type === 'roll' && last._merge) last.items.push(...items);
      else out.push({ id: uid(), type: 'roll', items, _merge: true });
    } else if (w.widgetName === 'raTextBlock') {
      out.push({ id: uid(), type: 'text', title: readText(w.title), text: readText(w.text), theme: w.theme || 'primary' });
    } else if (w.widgetName === 'list' && w.theme === 'image') {
      out.push({ id: uid(), type: 'catalog', items: bl.map((x) => ({ title: readText(x.title), sku: skuFromUrl(readLink(x.title) || x.imgLink), text: readText(x.text), img: readImg(x.img) })) });
    } else if (w.widgetName === 'list') {
      out.push({ id: uid(), type: 'faq', items: bl.map((x) => ({ q: readText(x.title), a: readText(x.text) })) });
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
  });
  const empty = imgs.filter(([, u]) => !u);
  const bad = imgs.filter(([, u]) => u && !IMG_RE.test(u));
  if (empty.length) problems.push(`Нет картинки: ${[...new Set(empty.map(([w]) => w))].join(', ')}`);
  if (bad.length) problems.push(`Адрес картинки должен начинаться с https:// и заканчиваться на .jpg, .jpeg или .png: ${[...new Set(bad.map(([w]) => w))].join(', ')}`);
  if (noSku.length) problems.push(`Без SKU, ссылки не будет: ${noSku.join(', ')}`);
  if (!blocks.length) problems.push('Добавьте хотя бы один блок');
  return problems;
}
