// Редактор rich-контента Ozon: интерфейс.
// Один набор блоков рисуется и для ПК, и для телефона, поэтому правка в одном виде
// сразу видна в другом. Картинка для телефона подставляется из ПК, если своей нет.
import { DEFAULT_SIZE, TILE_LAYOUTS, tileRows, MARKS, scale, LINK_RE, emptyImage, TYPES, newBlock, toOzon, fromOzon, check, resolveImage, productUrl, SIZES, COLORS, THEMES, getStyle, DEFAULT_STYLE } from './rich.js';
import { EMOJI, SYMBOLS } from './emoji.js';
import { PRESETS } from './presets.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const clone = (x) => JSON.parse(JSON.stringify(x));
const DRAFT = 'rich-ozon-draft-v1';
const LOCAL = 'rich-ozon-templates-v1';

let state = { id: '', name: 'Смола шу пуэра', blocks: PRESETS.shu.blocks() };
let sel = state.blocks[0]?.id || '';
let view = 'pc';
let server = false; // есть ли сервер с общими шаблонами
const undoStack = [];

// ---------- Хранилище ----------
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* браузер запретил */ } };

async function api(path, opt = {}) {
  const r = await fetch(`api/${path}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opt });
  if (r.status === 401) { showGate('Время входа истекло. Откройте редактор заново из «Менеджмента».'); throw new Error('auth'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `Ошибка сервера ${r.status}`);
  return data;
}

function showGate(text) { $('gate-msg').textContent = text; $('gate').hidden = false; }

async function boot() {
  // Вход по одноразовой ссылке из «Менеджмента»: #t=ТОКЕН.
  const m = location.hash.match(/t=([A-Za-z0-9_-]{10,200})/);
  try {
    if (m) {
      window.history.replaceState(null, "", location.pathname + location.search);
      await api('session', { method: 'POST', body: JSON.stringify({ token: m[1] }) });
    }
    const me = await api('me');
    server = Boolean(me.ok);
  } catch (e) {
    if (e.message === 'auth') return;
    server = false; // открыт как файл без сервера: работаем в браузере
  }
  const draft = lsGet(DRAFT, null);
  if (draft?.blocks) { state = draft; sel = state.blocks[0]?.id || ''; }
  await fillTemplates();
  render();
}

// ---------- История правок ----------
let lastPush = 0;
function remember(force) {
  const now = Date.now();
  if (!force && now - lastPush < 800) return; // серия нажатий — одна отмена
  lastPush = now;
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 60) undoStack.shift();
}
function undo() {
  const prev = undoStack.pop();
  if (!prev) return toast('Отменять нечего');
  state = JSON.parse(prev);
  if (!state.blocks.some((b) => b.id === sel)) sel = state.blocks[0]?.id || '';
  render();
}
const saveDraft = () => lsSet(DRAFT, state);

// ---------- Отрисовка ----------
const blockById = (id) => state.blocks.find((b) => b.id === id);
const blockProblems = (b) => check([b]).filter((p) => !p.startsWith('Без SKU'));

function render() {
  renderList(); renderPreview(); renderInspector(); renderChecks();
  $('proj-name').value = state.name || '';
  $('undo').disabled = !undoStack.length;
}

function blockCaption(b) {
  if (b.title) return b.title;
  const it = (b.items || [])[0];
  return it ? (it.title || it.q || it.alt || '') : '';
}

function renderList() {
  $('count').textContent = `${state.blocks.length}`;
  $('list').innerHTML = state.blocks.map((b) => `
    <li data-id="${b.id}" class="${b.id === sel ? 'on' : ''}" tabindex="0" draggable="true" title="Перетащите, чтобы поменять порядок">
      <span class="grip" aria-hidden="true">⋮⋮</span><span class="nm">${esc(TYPES[b.type])}<small>${esc(blockCaption(b)) || '&nbsp;'}</small></span>
      ${blockProblems(b).length ? '<span class="bad" title="Есть замечания"></span>' : ''}
    </li>`).join('');
}

function imgHtml(type, img, label) {
  const r = resolveImage(type, img);
  const src = view === 'm' ? r.srcM : r.src;
  const [w, h] = view === 'm' ? [r.wM, r.hM] : [r.w, r.h];
  if (!src) return `<div class="noimg" style="aspect-ratio:${w}/${h}">${esc(label || 'Картинка')}<br>${w}×${h}</div>`;
  return `<img src="${esc(src)}" alt="${esc(label || '')}" width="${w}" height="${h}" loading="lazy" referrerpolicy="no-referrer">`;
}

// Текст ячейки: ссылки [подпись](адрес) показываем синими, как у Ozon.
const richHtml = (s) => esc(s).replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<span class="lnk">$1</span>').replace(/\n/g, '<br>');
function smallImg(img, label) {
  const r = resolveImage('thead', img || {});
  const src = view === 'm' ? r.srcM : r.src;
  return src ? `<img class="hico" src="${esc(src)}" alt="${esc(label || '')}" referrerpolicy="no-referrer">` : '';
}

// Редактируемый текст прямо в предпросмотре.
const ed = (b, path, val, cls) => {
  const which = /(^|\.)(title|q)$/.test(path) ? 'title' : 'text';
  const st = getStyle(b, which);
  const css = `font-size:${SIZES[st.size]}px;line-height:1.3;color:${COLORS[st.color].hex};text-align:${st.align}`;
  return `<div class="${cls} ${which === 'title' ? 'ttl' : 'txt'}" style="${css}" contenteditable="plaintext-only" data-b="${b.id}" data-f="${path}" spellcheck="true">${esc(val)}</div>`;
};

function renderPreview() {
  $('frame').className = `frame ${view}`;
  $('pv').innerHTML = blocksHtml(state.blocks);
}

// HTML предпросмотра для любого набора блоков (и для библиотеки шаблонов).
function blocksHtml(blocks) {
  if (!blocks.length) return '<div class="empty">Пусто. Добавьте блок слева или выберите шаблон в библиотеке.</div>';
  return blocks.map((b) => {
    let inner = '';
    if (b.type === 'hero') inner = `${imgHtml('hero', b.img, 'Обложка')}<div class="pad c">${ed(b, 'title', b.title, 's5')}${ed(b, 'text', b.text, 's3')}</div>`;
    if (b.type === 'chess') inner = b.items.map((it, i) => `<div class="chess ${i % 2 ? 'rev' : ''}"><div class="im">${imgHtml('chess', it.img, it.title)}</div><div class="tx">${ed(b, `items.${i}.title`, it.title, 's4')}${ed(b, `items.${i}.text`, it.text, 's3')}</div></div>`).join('');
    if (b.type === 'tiles') {
      // Ряды как у Ozon: tileL — сетка на 3, tileXL — на 2; на телефоне по одной.
      let from = 0;
      inner = tileRows(b.items.length, b.layout).map((row) => {
        const part = b.items.slice(from, from + row.count).map((it, k) => { const i = from + k;
          return `<div>${imgHtml('tiles', it.img, it.title)}${ed(b, `items.${i}.title`, it.title, 's4 c')}${ed(b, `items.${i}.text`, it.text, 's3 c')}</div>`; }).join('');
        from += row.count;
        return `<div class="tiles" style="--n:${row.type === 'tileXL' ? 2 : row.type === 'tileM' ? 4 : 3}">${part}</div>`;
      }).join('');
    }
    if (b.type === 'roll') inner = b.items.map((it) => imgHtml('roll', it.img, it.alt || 'Картинка во всю ширину')).join('');
    if (b.type === 'text') inner = `<div class="tb ${b.pad === 'type1' ? 'p1' : ''} ${b.gap === 's' ? 'gs' : ''}" style="background:${(THEMES[b.theme] || THEMES.default).bg}">${ed(b, 'title', b.title, 's5')}${ed(b, 'text', b.text, 's3')}${b.linkLabel ? `<div class="lnkbtn" style="text-align:${getStyle(b, 'text').align}"><span>${esc(b.linkLabel)}</span></div>` : ''}</div>`;
    if (b.type === 'faq') inner = b.items.map((it, i) => `<div class="faq">${ed(b, `items.${i}.q`, it.q, 's4')}${ed(b, `items.${i}.a`, it.a, 's3')}</div>`).join('');
    if (b.type === 'numlist') inner = `<ol class="numl">${b.items.map((it, i) => `<li>${ed(b, `items.${i}.q`, it.q, 's4')}${ed(b, `items.${i}.a`, it.a, 's3')}</li>`).join('')}</ol>`;
    if (b.type === 'table') { const st = getStyle(b, 'text'); const cs = `font-size:${SIZES[st.size]}px;color:${COLORS[st.color].hex};text-align:${st.align}`;
      const thead = b.hideHead ? '' : `<thead><tr>${b.head.map((h, i) => `<th style="${cs}">${smallImg((b.headImg || [])[i], h)}<div>${esc(h)}</div></th>`).join('')}</tr></thead>`;
      inner = `<div class="tbl">${ed(b, 'title', b.title, 's4')}<div class="tblw"><table>${thead}<tbody>${b.rows.map((r) => `<tr>${b.head.map((_, i) => `<td style="${cs}">${richHtml(r[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`; }
    if (b.type === 'taste') { const st = getStyle(b, 'text'); const cs = `font-size:${SIZES[st.size]}px;color:${COLORS[st.color].hex}`;
      const showHead = b.teas.length > 1 || b.teas.some((t) => t.name || (t.img && (t.img.src || t.img.srcM)));
      const thead = showHead ? `<thead><tr><th></th>${b.teas.map((t) => `<th style="${cs};text-align:center">${smallImg(t.img, t.name)}<div>${esc(t.name)}</div></th>`).join('')}</tr></thead>` : '';
      inner = `<div class="tbl">${ed(b, 'title', b.title, 's4')}<div class="tblw"><table>${thead}<tbody>${b.rows.map((r) => `<tr><td style="${cs}">${esc(r.name)}</td>${b.teas.map((_, i) => `<td class="scale" style="${cs};text-align:center">${scale(r.vals[i], b.max, b.mark)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`; }
    if (b.type === 'cards') inner = `<div class="cards">${b.items.map((it, i) => `<div class="card">${(() => { const r = resolveImage('cards', it.img); const src = view === 'm' ? r.srcM : r.src; return src ? `<img src="${esc(src)}" alt="" referrerpolicy="no-referrer">` : '<div class="noico">значок</div>'; })()}${ed(b, `items.${i}.title`, it.title, 's4 c')}${ed(b, `items.${i}.text`, it.text, 's3 c')}</div>`).join('')}</div>`;
    if (b.type === 'video') inner = `<div class="vid"><span>▶</span><small>${esc(b.src || 'Видеофайл .mp4 — вставьте ссылку')}</small></div>`;
    if (b.type === 'catalog') inner = b.items.map((it, i) => `<div class="cat"><div>${imgHtml('catalog', it.img, it.title)}</div><div>${ed(b, `items.${i}.title`, it.title, `s4 ${productUrl(it.sku) ? 'lnk' : ''}`)}${ed(b, `items.${i}.text`, it.text, 's3')}</div></div>`).join('');
    return `<div class="w ${b.id === sel ? 'on' : ''}" data-id="${b.id}" draggable="false"><span class="tag">${esc(TYPES[b.type])}</span>${inner}</div>`;
  }).join('');
}

// ---------- Настройки выбранного блока ----------
const fld = (path, label, val, opts = {}) => {
  const id = `f-${path.replace(/\./g, '-')}`;
  const ctl = opts.area
    ? `<textarea id="${id}" data-f="${path}" rows="3">${esc(val)}</textarea>`
    : `<input id="${id}" data-f="${path}" value="${esc(val)}" ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''} ${opts.mode ? `inputmode="${opts.mode}"` : ''}>`;
  return `<label for="${id}">${esc(label)}</label>${ctl}`;
};

function imgFields(type, base, img) {
  const r = resolveImage(type, img);
  // Размер из шаблона — только подсказка. Картинка другого размера растягивается Ozon по ширине блока
  // с сохранением своих пропорций, без рамок; в JSON уходит её настоящий размер.
  const def = DEFAULT_SIZE[type] || DEFAULT_SIZE.tiles;
  const own = (src, w, h, rec) => {
    if (!w || !h) return 'размер ещё не определился — проверьте, что ссылка открывается';
    const small = w < rec[0] * 0.75 ? ` · меньше рекомендуемых ${rec[0]} px по ширине, может выглядеть мыльно` : '';
    return `${w}×${h}${small}`;
  };
  const pcNote = img.src ? own(img.src, img.w, img.h, def.pc) : (img.srcM ? `берётся из телефона, ${r.w}×${r.h}` : `рекомендуется ${r.w}×${r.h}, подойдёт и другой размер`);
  const mNote = img.srcM ? `своя, ${own(img.srcM, img.wM, img.hM, def.m)}` : (img.src ? `подставлена из ПК, ${r.wM}×${r.hM}` : `рекомендуется ${r.wM}×${r.hM}, подойдёт и другой размер`);
  return `${fld(`${base}.src`, 'Картинка для ПК — ссылка .jpg или .png', img.src, { ph: 'https://…/картинка.jpg' })}
    <div class="size ${!img.src && img.srcM ? 'sync' : ''}">${esc(pcNote)}</div>
    ${fld(`${base}.srcM`, 'Картинка для телефона — если пусто, как для ПК', img.srcM, { ph: 'необязательно' })}
    <div class="size ${img.src && !img.srcM ? 'sync' : ''}">${esc(mNote)}</div>`;
}

const ITEM_NAMES = { chess: 'Блок', tiles: 'Плитка', roll: 'Картинка', faq: 'Вопрос', numlist: 'Пункт', catalog: 'Чай', cards: 'Карточка' };

// Маленькое поле картинки (шапка таблицы, значок): одна ссылка на оба вида.
const imgMini = (path, label, img) => fld(path, label, (img || {}).src || '', { ph: 'https://…/картинка.png — необязательно' });

function tasteEditor(b) {
  const teas = b.teas.map((t, i) => `<div class="grp"><div class="gh"><b>Чай ${i + 1}</b><button type="button" class="icon ghost danger" data-act="tteadel" data-i="${i}" aria-label="Убрать чай" ${b.teas.length < 2 ? 'disabled' : ''}>×</button></div>
    ${fld(`teas.${i}.name`, b.teas.length > 1 ? 'Название в шапке' : 'Название в шапке — можно оставить пустым', t.name, { ph: 'Шу пуэр' })}
    ${imgMini(`teas.${i}.img.src`, 'Картинка над названием (Ozon показывает 96×96)', t.img)}</div>`).join('');
  const marks = Object.entries(MARKS).map(([k, [on, off]]) => `<option value="${k}" ${b.mark === k ? 'selected' : ''}>${on}${on}${on}${off}${off}</option>`).join('');
  const rows = b.rows.map((r, ri) => `<div class="trow" style="--cols:${b.teas.length + 1}"><input data-f="rows.${ri}.name" value="${esc(r.name)}" aria-label="Свойство ${ri + 1}">${b.teas.map((_, ci) => `<select data-f="rows.${ri}.vals.${ci}" data-num="1" aria-label="${esc(r.name)}: оценка">${Array.from({ length: b.max + 1 }, (_, v) => `<option value="${v}" ${Number(r.vals[ci] || 0) === v ? 'selected' : ''}>${v} ${scale(v, b.max, b.mark)}</option>`).join('')}</select>`).join('')}<button type="button" class="icon ghost danger" data-act="trowdel" data-i="${ri}" aria-label="Удалить строку">×</button></div>`).join('');
  return `${fld('title', 'Заголовок', b.title)}
    <div class="row2"><div><label for="f-mark">Значки</label><select id="f-mark" data-f="mark">${marks}</select></div>
    <div><label for="f-max">Шкала</label><select id="f-max" data-f="max" data-num="1">${[3, 5, 10].map((v) => `<option value="${v}" ${b.max === v ? 'selected' : ''}>из ${v}</option>`).join('')}</select></div></div>
    <label>Свойства и оценки</label>${rows}
    <div class="blk-acts"><button type="button" class="sm ghost" data-act="tasterow">Добавить свойство</button><button type="button" class="sm ghost" data-act="tasteadd">Добавить чай для сравнения</button></div>
    ${teas}
    <p class="note">Уходит в Ozon таблицей. Один чай без названия — таблица без шапки; несколько чаёв — сравнение столбцами, с картинками в шапке.</p>`;
}

// Оформление текста: только то, что разрешает Ozon — размер, цвет, выравнивание.
function styleControls(b) {
  if (['roll', 'video'].includes(b.type)) return '';
  const part = (which, label) => {
    const st = getStyle(b, which);
    const def = DEFAULT_STYLE[b.type][which];
    return `<div class="stl"><b>${label}</b>
      <div class="stl-row"><select data-style="${which}.size" aria-label="${label}: размер">${Object.entries(SIZES).map(([k, px]) => `<option value="${k}" ${st.size === k ? 'selected' : ''}>${px} px${def.size === k ? ' · обычный' : ''}</option>`).join('')}</select>
      <span class="seg sm-seg" role="group" aria-label="${label}: выравнивание">${[['left', '⟸'], ['center', '≡'], ['right', '⟹']].map(([v, t]) => `<button type="button" class="${st.align === v ? 'on' : ''}" data-style="${which}.align" data-v="${v}" title="${{ left: 'По левому краю', center: 'По центру', right: 'По правому краю' }[v]}">${t}</button>`).join('')}</span></div>
      <div class="sw" role="group" aria-label="${label}: цвет">${Object.entries(COLORS).map(([k, c]) => `<button type="button" class="${st.color === k ? 'on' : ''}" data-style="${which}.color" data-v="${k}" title="${c.name}" style="background:${c.hex}"></button>`).join('')}<span>${COLORS[st.color].name}</span></div></div>`;
  };
  return `<div class="grp style-grp"><div class="gh"><b>Оформление текста</b><button type="button" class="sm ghost" data-act="sreset">Как было</button></div>
    ${part('title', b.type === 'table' ? 'Заголовок таблицы' : 'Заголовки')}${part('text', b.type === 'table' ? 'Ячейки' : 'Текст')}
    <p class="note">Шрифт в карточке всегда фирменный шрифт Ozon — его поменять нельзя. Жирного и курсива в rich-контенте нет.</p></div>`;
}

function tableEditor(b) {
  const head = b.head.map((h, i) => `<div class="cell"><input data-f="head.${i}" value="${esc(h)}" aria-label="Столбец ${i + 1}"><button type="button" class="icon ghost danger" data-act="tcoldel" data-i="${i}" aria-label="Удалить столбец" ${b.head.length < 2 ? 'disabled' : ''}>×</button></div>`).join('');
  const rows = b.rows.map((r, ri) => `<div class="trow">${b.head.map((_, ci) => `<input data-f="rows.${ri}.${ci}" value="${esc(r[ci] ?? '')}" aria-label="Строка ${ri + 1}, столбец ${ci + 1}">`).join('')}<button type="button" class="icon ghost danger" data-act="trowdel" data-i="${ri}" aria-label="Удалить строку">×</button></div>`).join('');
  const phone = b.head.length <= 2 ? 'на телефоне таблица помещается целиком' : (b.head.length === 3 ? 'на телефоне помещается на большинстве экранов, на узких — чуть листается вбок' : 'на телефоне таблица листается пальцем вбок');
  const imgs = b.hideHead ? '' : `<details class="grp" ${(b.headImg || []).some((im) => im && im.src) ? 'open' : ''}><summary><b>Картинки в шапке</b> — над названием столбца, 96×96</summary>${b.head.map((h, i) => imgMini(`headImg.${i}.src`, `Столбец «${h}»`, (b.headImg || [])[i])).join('')}<p class="note">В строках таблицы картинок Ozon не допускает — только в шапке. Удобно для сравнения: фото чая над его столбцом.</p></details>`;
  return `${fld('title', 'Заголовок таблицы', b.title)}<p class="note">Столбцов: ${b.head.length} — ${phone}. Ozon делает каждый столбец не уже 120 px.</p>
    <label class="chk"><input type="checkbox" data-f="hideHead" ${b.hideHead ? 'checked' : ''}> Без шапки — таблица «характеристика — значение»</label>
    <label>${b.hideHead ? 'Столбцы (названия не видны покупателю)' : 'Столбцы'}</label><div class="thead">${head}</div>${imgs}
    <label>Строки</label><div class="tbody" style="--cols:${b.head.length}">${rows}</div>
    <div class="blk-acts"><button type="button" class="sm ghost" data-act="trowadd">Добавить строку</button><button type="button" class="sm ghost" data-act="tcoladd">Добавить столбец</button></div>
    <p class="note">Ссылка в ячейке: [подпись](https://www.ozon.ru/…) — или кнопка «🔗 Ссылка» вверху.</p>`;
}

function videoEditor(b) {
  return fld('src', 'Прямая ссылка на видео .mp4', b.src, { ph: 'https://…/video.mp4' })
    + `<div class="row2">${fld('w', 'Ширина', b.w, { mode: 'numeric' })}${fld('h', 'Высота', b.h, { mode: 'numeric' })}</div>
    <p class="note">Только видеофайл. Ролики YouTube у покупателей в России не грузятся. Ozon проверяет видео при модерации.</p>`;
}

function linkEditor(b) {
  return `<div class="grp"><div class="gh"><b>Кнопка-ссылка под текстом</b></div>
    ${fld('linkLabel', 'Подпись', b.linkLabel, { ph: 'Задать вопрос продавцу →' })}
    ${fld('linkUrl', 'Адрес на ozon.ru', b.linkUrl, { ph: 'https://www.ozon.ru/…' })}
    <div class="blk-acts"><button type="button" class="sm ghost" data-act="lnkshop">Страница магазина</button><button type="button" class="sm ghost" data-act="lnkclear">Убрать</button></div>
    <p class="note">Только ссылки на ozon.ru: страница магазина, другой товар, подборка. «Написать продавцу» — родная кнопка Ozon в карточке, отдельной ссылки на чат нет.</p></div>`;
}

function itemFields(b, it, i) {
  const p = `items.${i}`;
  if (b.type === 'chess') return fld(`${p}.title`, 'Заголовок', it.title) + fld(`${p}.text`, `Текст (${(it.text || '').length} из 260)`, it.text, { area: 1 }) + imgFields('chess', `${p}.img`, it.img);
  if (b.type === 'tiles') return fld(`${p}.title`, 'Название', it.title) + fld(`${p}.text`, 'Подпись', it.text) + fld(`${p}.sku`, 'SKU Ozon — куда ведёт плитка', it.sku, { mode: 'numeric' }) + imgFields('tiles', `${p}.img`, it.img);
  if (b.type === 'roll') return fld(`${p}.sku`, 'SKU Ozon — куда ведёт картинка', it.sku, { mode: 'numeric' }) + fld(`${p}.link`, 'Или ссылка на страницу Ozon', it.link, { ph: 'https://www.ozon.ru/…' }) + fld(`${p}.alt`, 'Описание картинки', it.alt) + imgFields('roll', `${p}.img`, it.img);
  if (b.type === 'cards') return fld(`${p}.title`, 'Заголовок', it.title) + fld(`${p}.text`, 'Текст', it.text) + fld(`${p}.sku`, 'SKU Ozon — необязательно, если карточка должна вести на товар', it.sku, { mode: 'numeric' }) + imgFields('cards', `${p}.img`, it.img) + '<p class="note">Значок Ozon показывает маленьким: 50×50 на компьютере, 40×40 на телефоне. Подойдёт квадратная картинка 200×200.</p>';
  if (b.type === 'faq') return fld(`${p}.q`, 'Вопрос', it.q) + fld(`${p}.a`, 'Ответ', it.a, { area: 1 });
  if (b.type === 'numlist') return fld(`${p}.q`, 'Заголовок пункта', it.q) + fld(`${p}.a`, 'Текст', it.a, { area: 1 });
  if (b.type === 'catalog') return fld(`${p}.title`, 'Название', it.title) + fld(`${p}.sku`, 'SKU Ozon', it.sku, { mode: 'numeric' }) + fld(`${p}.text`, 'Описание', it.text, { area: 1 }) + imgFields('catalog', `${p}.img`, it.img);
  return '';
}

function renderInspector() {
  const b = blockById(sel);
  $('insp-title').textContent = b ? TYPES[b.type] : 'Блок';
  if (!b) { $('insp').innerHTML = '<p class="muted">Выберите блок слева или в предпросмотре.</p>'; return; }
  const n = state.blocks.indexOf(b);
  let html = '';
  if (b.type === 'hero') html = fld('title', 'Заголовок', b.title) + fld('text', 'Текст', b.text, { area: 1 }) + imgFields('hero', 'img', b.img);
  if (b.type === 'text') html = fld('title', 'Заголовок', b.title) + fld('text', 'Текст', b.text, { area: 1 })
    + `<label for="f-theme">Фон</label><select id="f-theme" data-f="theme">${Object.entries(THEMES).map(([v, t]) => `<option value="${v}" ${b.theme === v ? 'selected' : ''}>${t.name}</option>`).join('')}</select>
    <div class="row2"><div><label for="f-pad">Поля вокруг</label><select id="f-pad" data-f="pad"><option value="type2" ${b.pad !== 'type1' ? 'selected' : ''}>С полями</option><option value="type1" ${b.pad === 'type1' ? 'selected' : ''}>Без полей</option></select></div>
    <div><label for="f-gap">Между заголовком и текстом</label><select id="f-gap" data-f="gap"><option value="m" ${b.gap !== 's' ? 'selected' : ''}>Обычно</option><option value="s" ${b.gap === 's' ? 'selected' : ''}>Плотнее</option></select></div></div>` + linkEditor(b);
  if (b.type === 'taste') html = tasteEditor(b);
  if (b.type === 'table') html = tableEditor(b);
  if (b.type === 'video') html = videoEditor(b);
  if (b.type === 'tiles') {
    const rows = tileRows(b.items.length, b.layout || 'auto');
    const scheme = rows.flatMap((r) => { const out = []; let left = r.count; const per = r.type === 'tileXL' ? 2 : r.type === 'tileM' ? 4 : 3; while (left > 0) { out.push(`${Math.min(per, left)}${r.type === 'tileXL' ? ' крупные' : r.type === 'tileM' ? ' мелкие' : ''}`); left -= per; } return out; }).join(' / ') || '—';
    html += `<div class="grp"><label for="f-layout">Раскладка плиток</label><select id="f-layout" data-f="layout">${Object.entries(TILE_LAYOUTS).map(([v, t]) => `<option value="${v}" ${(b.layout || 'auto') === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <p class="note">Ряды на компьютере: <b>${esc(scheme)}</b>. Ozon прижимает неполный ряд к левому краю, поэтому в «Авто» ряд из двух делается крупными плитками на всю ширину — он стоит ровно по центру. На телефоне плитки идут по одной.</p></div>`;
  }
  if (b.items) {
    html += b.items.map((it, i) => `<div class="grp"><div class="gh"><b>${ITEM_NAMES[b.type]} ${i + 1}</b><span>
      <button class="icon ghost" data-act="iup" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Выше">↑</button>
      <button class="icon ghost" data-act="idown" data-i="${i}" ${i < b.items.length - 1 ? '' : 'disabled'} aria-label="Ниже">↓</button>
      <button class="icon ghost danger" data-act="idel" data-i="${i}" aria-label="Удалить">×</button></span></div>${itemFields(b, it, i)}</div>`).join('');
    html += `<button class="ghost" data-act="iadd" style="margin-top:12px">Добавить: ${ITEM_NAMES[b.type].toLowerCase()}</button>`;
  }
  html += styleControls(b);
  html += `<div class="blk-acts">
    <button class="sm ghost" data-act="up" ${n ? '' : 'disabled'}>Блок выше</button>
    <button class="sm ghost" data-act="down" ${n < state.blocks.length - 1 ? '' : 'disabled'}>Блок ниже</button>
    <button class="sm ghost" data-act="dup">Копия</button>
    <button class="sm ghost danger" data-act="del">Удалить блок</button></div>`;
  $('insp').innerHTML = html;
}

function renderChecks() {
  const p = check(state.blocks);
  const json = JSON.stringify(toOzon(state.blocks));
  $('checks').innerHTML = p.length ? p.map((x) => `<li>${esc(x)}</li>`).join('') : `<li class="ok">Ошибок нет. JSON: ${json.length.toLocaleString('ru')} знаков</li>`;
}

// ---------- Изменение данных ----------
function setPath(obj, path, val) {
  const k = path.split('.');
  let o = obj;
  for (let i = 0; i < k.length - 1; i++) o = o[k[i]];
  o[k[k.length - 1]] = val;
}

// Размер картинки узнаём, загрузив её в браузере.
function measure(b, path, url) {
  if (!/^https?:\/\//.test(url)) return;
  const im = new Image();
  im.referrerPolicy = 'no-referrer';
  im.onload = () => {
    const base = path.replace(/\.(src|srcM)$/, '');
    const mobile = path.endsWith('srcM');
    const img = base.split('.').reduce((o, k) => o[k], b);
    if ((mobile ? img.srcM : img.src) !== url) return;
    if (mobile) { img.wM = im.naturalWidth; img.hM = im.naturalHeight; } else { img.w = im.naturalWidth; img.h = im.naturalHeight; }
    saveDraft(); renderPreview(); renderInspector(); renderChecks();
  };
  im.src = url;
}

function onField(e) {
  const f = e.target.dataset.f;
  if (!f) return;
  const b = blockById(sel);
  if (!b) return;
  remember();
  let val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (e.target.dataset.num) val = Number(val);
  // Картинки в шапке таблицы/профиля: объекта может ещё не быть.
  const m = f.match(/^(headImg\.\d+|teas\.\d+\.img)\.src$/);
  if (m) {
    const parts = m[1].split('.');
    let o = b; for (const k of parts.slice(0, -1)) { o[k] = o[k] || (k === 'headImg' ? [] : {}); o = o[k]; }
    const last = parts[parts.length - 1];
    o[last] = { ...emptyImage(), ...(o[last] || {}), src: String(val).trim(), srcM: '' };
    saveDraft(); renderPreview(); renderList(); renderChecks();
    if (e.type === 'change') renderInspector();
    return;
  }
  setPath(b, f, val);
  if (f === 'max') b.rows.forEach((r) => { r.vals = r.vals.map((v) => Math.min(v, val)); });
  if (/\.(src|srcM)$/.test(f)) {
    const base = f.replace(/\.(src|srcM)$/, '');
    const img = base.split('.').reduce((o, k) => o[k], b);
    if (f.endsWith('srcM')) { img.wM = 0; img.hM = 0; } else { img.w = 0; img.h = 0; }
    measure(b, f, val.trim());
  }
  saveDraft();
  renderPreview(); renderList(); renderChecks();
  if (e.type === 'change') renderInspector();
}

function onPreviewEdit(e) {
  const el = e.target.closest('[contenteditable]');
  if (!el) return;
  const b = blockById(el.dataset.b);
  if (!b) return;
  remember();
  setPath(b, el.dataset.f, el.innerText.replace(/\n$/, ''));
  saveDraft();
  renderList(); renderChecks();
  // Обновляем поле справа, не трогая предпросмотр, чтобы не сбить курсор.
  const input = document.querySelector(`#insp [data-f="${el.dataset.f}"]`);
  if (input && el.dataset.b === sel) input.value = el.innerText.replace(/\n$/, '');
}

function select(id, scroll) {
  sel = id;
  renderList(); renderInspector();
  document.querySelectorAll('#pv .w').forEach((w) => w.classList.toggle('on', w.dataset.id === id));
  if (scroll) document.querySelector(`#pv .w[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function onAction(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const b = blockById(sel);
  if (!b) return;
  remember(true);
  const i = Number(btn.dataset.i);
  const n = state.blocks.indexOf(b);
  const arr = b.items;
  const swap = (a, x, y) => { [a[x], a[y]] = [a[y], a[x]]; };
  switch (btn.dataset.act) {
    case 'iup': swap(arr, i, i - 1); break;
    case 'idown': swap(arr, i, i + 1); break;
    case 'idel': arr.splice(i, 1); break;
    case 'iadd': arr.push(clone(newBlock(b.type).items[0])); break;
    case 'trowadd': b.rows.push(b.head.map(() => '')); break;
    case 'trowdel': b.rows.splice(i, 1); break;
    case 'tcoladd': b.head.push('Столбец'); b.rows.forEach((r) => r.push('')); break;
    case 'tcoldel': b.head.splice(i, 1); (b.headImg || []).splice(i, 1); b.rows.forEach((r) => r.splice(i, 1)); break;
    case 'tasterow': b.rows.push({ name: 'Свойство', vals: b.teas.map(() => 0) }); break;
    case 'tasteadd': b.teas.push({ name: `Чай ${b.teas.length + 1}`, img: emptyImage() }); b.rows.forEach((r) => r.vals.push(0)); break;
    case 'tteadel': b.teas.splice(i, 1); b.rows.forEach((r) => r.vals.splice(i, 1)); break;
    case 'lnkshop': {
      const u = (prompt('Вставьте ссылку на страницу магазина на Ozon (откройте магазин в Ozon и скопируйте адрес):', '') || '').trim();
      if (!/^https:\/\/(www\.)?ozon\.ru\//.test(u)) { toast('Нужна ссылка, которая начинается с https://www.ozon.ru/'); return; }
      b.linkUrl = u.split('?')[0]; if (!b.linkLabel) b.linkLabel = 'Все чаи магазина →'; break;
    }
    case 'lnkclear': b.linkLabel = ''; b.linkUrl = ''; break;
    case 'sreset': delete b.style; break;
    case 'up': swap(state.blocks, n, n - 1); break;
    case 'down': swap(state.blocks, n, n + 1); break;
    case 'dup': { const c = clone(b); c.id = newBlock('text').id; state.blocks.splice(n + 1, 0, c); sel = c.id; break; }
    case 'del': state.blocks.splice(n, 1); sel = state.blocks[Math.min(n, state.blocks.length - 1)]?.id || ''; break;
    default: return;
  }
  saveDraft(); render();
}

// ---------- Библиотека шаблонов ----------
// Шаблоны хранятся на сервере (общие для всех в «Менеджменте»); без сервера — в этом браузере.
let lib = [];
async function fillTemplates() {
  if (server) { try { lib = (await api('templates')).items || []; } catch { lib = []; } }
  else lib = Object.entries(lsGet(LOCAL, {})).map(([id, t]) => ({ id, name: t.name, updatedAt: t.updatedAt, count: (t.blocks || []).length }));
}
const loadSaved = async (id) => (server ? api(`templates/${encodeURIComponent(id)}`) : lsGet(LOCAL, {})[id]);
async function putSaved(id, name, blocks) {
  if (server) await api(`templates/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ name, blocks }) });
  else { const all = lsGet(LOCAL, {}); all[id] = { name, blocks, updatedAt: new Date().toISOString() }; lsSet(LOCAL, all); }
}
async function delSaved(id) {
  if (server) await api(`templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
  else { const all = lsGet(LOCAL, {}); delete all[id]; lsSet(LOCAL, all); }
}
const slug = (s) => (s || 'shablon').toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'shablon';
const newId = (name) => `${slug(name)}-${Date.now().toString(36)}`;
const when = (iso) => { try { return new Date(iso).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const blocksWord = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'блок' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'блока' : 'блоков')}`;

let libSel = null; // { kind: 'saved' | 'preset', id, name, blocks }
function renderLib() {
  const q = ($('lib-q').value || '').trim().toLowerCase();
  const hit = (n) => !q || String(n).toLowerCase().includes(q);
  const card = (kind, id, name, meta) => `<li><button type="button" class="lib-item ${libSel && libSel.kind === kind && libSel.id === id ? 'on' : ''}" data-kind="${kind}" data-id="${esc(id)}"><b>${esc(name)}</b><small>${esc(meta)}</small></button></li>`;
  const mine = lib.filter((t) => hit(t.name));
  const presets = Object.entries(PRESETS).filter(([, p]) => hit(p.name));
  $('lib-list').innerHTML = `<h3>${server ? 'Мои шаблоны — общие для всех в «Менеджменте»' : 'Мои шаблоны — в этом браузере'}</h3>
    ${mine.length ? `<ul>${mine.map((t) => card('saved', t.id, t.name, `${t.count != null ? `${blocksWord(t.count)} · ` : ''}${when(t.updatedAt)}${state.id === t.id ? ' · открыт сейчас' : ''}`)).join('')}</ul>` : `<p class="muted">${q ? 'Ничего не найдено' : 'Пока пусто. Сохраните текущий шаблон под своим названием.'}</p>`}
    <h3>Готовые</h3>${presets.length ? `<ul>${presets.map(([k, p]) => card('preset', k, p.name, 'образец')).join('')}</ul>` : '<p class="muted">Ничего не найдено</p>'}`;
  const pane = $('lib-pv');
  if (!libSel) { pane.innerHTML = '<p class="muted lib-empty">Выберите шаблон в списке — здесь появится, как он выглядит.</p>'; $('lib-acts').hidden = true; return; }
  $('lib-acts').hidden = false;
  $('lib-name').textContent = libSel.name;
  $('lib-meta').textContent = `${blocksWord(libSel.blocks.length)}${libSel.kind === 'preset' ? ' · готовый образец' : ''}`;
  ['lib-ren', 'lib-del'].forEach((x) => { $(x).hidden = libSel.kind !== 'saved'; });
  pane.innerHTML = `<div class="frame ${view} mini" inert><div class="pv">${blocksHtml(libSel.blocks)}</div></div>`;
}
async function pickLib(kind, id) {
  try {
    if (kind === 'preset') { const p = PRESETS[id]; libSel = { kind, id, name: p.name, blocks: p.blocks() }; }
    else { const t = await loadSaved(id); if (!t) return toast('Шаблон не найден'); libSel = { kind, id, name: t.name, blocks: t.blocks }; }
    renderLib();
  } catch (e) { if (e.message !== 'auth') toast(e.message); }
}
async function openLibrary() {
  await fillTemplates();
  $('lib-new').value = state.name && !state.id ? state.name : '';
  libSel = null;
  if (state.id && lib.some((t) => t.id === state.id)) await pickLib('saved', state.id);
  renderLib();
  $('lib').showModal();
}
function openTemplate(t) {
  remember(true);
  state = { id: t.kind === 'saved' ? t.id : '', name: t.name, blocks: clone(t.blocks) };
  sel = state.blocks[0]?.id || '';
  saveDraft(); render();
  toast(`Открыт «${t.name}». Прежний вид можно вернуть кнопкой «Отменить».`);
}
async function libAction(act) {
  if (act === 'close') { $('lib').close(); return; }
  try {
    if (act === 'open' && libSel) { openTemplate(libSel); $('lib').close(); return; }
    if (act === 'copy' && libSel) {
      const name = (prompt('Название копии:', `${libSel.name} — копия`) || '').trim(); if (!name) return;
      const id = newId(name); await putSaved(id, name, libSel.blocks); await fillTemplates(); await pickLib('saved', id); toast('Копия сохранена'); return;
    }
    if (act === 'ren' && libSel && libSel.kind === 'saved') {
      const name = (prompt('Новое название:', libSel.name) || '').trim(); if (!name || name === libSel.name) return;
      await putSaved(libSel.id, name, libSel.blocks); if (state.id === libSel.id) { state.name = name; saveDraft(); $('proj-name').value = name; }
      await fillTemplates(); await pickLib('saved', libSel.id); toast('Переименовано'); return;
    }
    if (act === 'del' && libSel && libSel.kind === 'saved') {
      if (!confirm(`Удалить шаблон «${libSel.name}» из библиотеки? Вернуть его будет нельзя.`)) return;
      await delSaved(libSel.id); if (state.id === libSel.id) { state.id = ''; saveDraft(); }
      libSel = null; await fillTemplates(); renderLib(); toast('Шаблон удалён'); return;
    }
    if (act === 'savenew') {
      const name = ($('lib-new').value || '').trim(); if (!name) { $('lib-new').focus(); return toast('Впишите название'); }
      const id = newId(name); await putSaved(id, name, state.blocks);
      state.id = id; state.name = name; saveDraft(); $('proj-name').value = name;
      await fillTemplates(); await pickLib('saved', id); toast('Сохранено в библиотеку'); return;
    }
  } catch (e) { if (e.message !== 'auth') toast(e.message); }
}

// «Сохранить»: обновляет открытый шаблон; если он новый — кладёт в библиотеку под названием сверху.
async function saveTemplate() {
  const name = ($('proj-name').value || '').trim();
  if (!name) { $('proj-name').focus(); return toast('Впишите название шаблона'); }
  state.name = name;
  const id = state.id || newId(name);
  try {
    await putSaved(id, name, state.blocks);
    state.id = id; saveDraft(); await fillTemplates();
    toast(server ? 'Сохранено в библиотеку — шаблон видят все в «Менеджменте»' : 'Сохранено в библиотеку этого браузера');
  } catch (e) { if (e.message !== 'auth') toast(e.message); }
}

// ---------- Окна импорта и экспорта ----------
function dialog({ title, text, value, ok, readonly, onOk }) {
  $('dlg-title').textContent = title; $('dlg-text').textContent = text;
  const area = $('dlg-area'); area.value = value || ''; area.readOnly = Boolean(readonly);
  $('dlg-msg').textContent = ''; $('dlg-msg').className = 'msg';
  $('dlg-ok').textContent = ok;
  $('dlg-ok').onclick = (e) => { e.preventDefault(); onOk(area.value); };
  $('dlg').showModal();
  if (!readonly) area.focus();
}

function exportJson() {
  const json = JSON.stringify(toOzon(state.blocks));
  const p = check(state.blocks);
  dialog({
    title: 'JSON для Ozon',
    text: `Вставьте в карточку: товар → «Редактировать» → «Медиа» → «Rich-контент JSON». ${p.length ? `Замечаний: ${p.length}, они справа в «Проверке».` : 'Замечаний нет.'}`,
    value: json, ok: 'Скопировать', readonly: true,
    onOk: async () => {
      try { await navigator.clipboard.writeText(json); $('dlg-msg').className = 'msg ok'; $('dlg-msg').textContent = 'Скопировано'; }
      catch { $('dlg-area').select(); $('dlg-msg').textContent = 'Текст выделен — нажмите Ctrl+C'; }
    },
  });
}

function importJson() {
  dialog({
    title: 'Импорт JSON',
    text: 'Вставьте код rich-контента из карточки Ozon. Текущие блоки заменятся — их можно вернуть кнопкой «Отменить».',
    value: '', ok: 'Загрузить',
    onOk: (txt) => {
      try {
        const { blocks, skipped } = fromOzon(txt.trim());
        remember(true);
        state = { id: '', name: 'Импорт', blocks };
        sel = blocks[0]?.id || '';
        saveDraft(); render(); $('dlg').close();
        toast(skipped.length ? `Загружено. Пропущены неизвестные блоки: ${skipped.join(', ')}` : `Загружено блоков: ${blocks.length}`);
      } catch (e) { $('dlg-msg').textContent = e instanceof SyntaxError ? 'Это не JSON: проверьте, что код скопирован целиком' : e.message; }
    },
  });
}

// ---------- Эмодзи и символы ----------
// Вставляются туда, где стоял курсор: в поле справа или в текст прямо в предпросмотре.
let lastField = null; let lastRange = null;
document.addEventListener('focusin', (e) => {
  const t = e.target;
  if (t.matches('#insp input:not([type=checkbox]), #insp textarea, #pv [contenteditable], #proj-name')) lastField = t;
});
document.addEventListener('selectionchange', () => {
  const s = window.getSelection();
  if (s.rangeCount && lastField && lastField.isContentEditable && lastField.contains(s.anchorNode)) lastRange = s.getRangeAt(0).cloneRange();
});
function insertSymbol(ch) {
  const el = lastField;
  if (!el || !document.body.contains(el)) return toast('Сначала поставьте курсор в текст блока');
  if (el.isContentEditable) {
    el.focus();
    const sel2 = window.getSelection();
    if (lastRange && el.contains(lastRange.startContainer)) { sel2.removeAllRanges(); sel2.addRange(lastRange); }
    document.execCommand('insertText', false, ch);
  } else {
    const a = el.selectionStart ?? el.value.length; const z = el.selectionEnd ?? a;
    el.value = el.value.slice(0, a) + ch + el.value.slice(z);
    el.focus(); el.setSelectionRange(a + ch.length, a + ch.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
function renderPicker(tab) {
  const groups = tab === 'sym' ? SYMBOLS : EMOJI;
  $('emo-body').innerHTML = groups.map((g) => `<div class="emo-g"><b>${esc(g.name)}</b><div>${g.items.map((c) => `<button type="button" class="emo" data-ch="${esc(c)}" title="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>`).join('');
  $('emo-t-e').setAttribute('aria-pressed', tab !== 'sym'); $('emo-t-s').setAttribute('aria-pressed', tab === 'sym');
}
$('emoji').addEventListener('mousedown', (e) => e.preventDefault());
$('emoji').onclick = () => { const p = $('emo'); p.hidden = !p.hidden; if (!p.hidden) renderPicker('emo'); };
$('emo').addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
$('emo').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'emo-t-e') return renderPicker('emo');
  if (b.id === 'emo-t-s') return renderPicker('sym');
  if (b.id === 'emo-x') { $('emo').hidden = true; return; }
  if (b.dataset.ch) insertSymbol(b.dataset.ch);
});

// Ссылка внутри текста: вставляем [подпись](адрес) туда, где курсор.
function insertLink() {
  const el = lastField;
  if (!el || !document.body.contains(el)) return toast('Сначала поставьте курсор в текст блока');
  const selected = el.isContentEditable ? String(window.getSelection()) : (el.value || '').slice(el.selectionStart ?? 0, el.selectionEnd ?? 0);
  const label = (prompt('Текст ссылки — что увидит покупатель:', selected || 'Смотреть') || '').trim(); if (!label) return;
  const url = (prompt('Адрес страницы на Ozon (https://www.ozon.ru/…):', 'https://www.ozon.ru/product/') || '').trim();
  if (!/^https:\/\/(www\.)?ozon\.ru\/\S+/.test(url)) return toast('Ozon разрешает ссылки только на свои страницы: https://www.ozon.ru/…');
  insertSymbol(`[${label}](${url.split('?')[0]})`);
}
$('link').addEventListener('mousedown', (e) => e.preventDefault());
$('link').onclick = insertLink;

let toastTimer;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200); }

// ---------- События ----------
$('add-type').innerHTML = Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${t}</option>`).join('');
$('add').onclick = () => {
  remember(true);
  const b = newBlock($('add-type').value);
  const n = state.blocks.findIndex((x) => x.id === sel);
  state.blocks.splice(n < 0 ? state.blocks.length : n + 1, 0, b);
  sel = b.id; saveDraft(); render(); select(b.id, true);
};
$('list').addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) select(li.dataset.id, true); });
$('list').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const li = e.target.closest('li'); if (li) select(li.dataset.id, true); } });
$('pv').addEventListener('click', (e) => { const w = e.target.closest('.w'); if (w && w.dataset.id !== sel) select(w.dataset.id); });
$('pv').addEventListener('input', onPreviewEdit);
// Битая ссылка на картинку: показываем заметную плашку вместо пустого места.
const onImgError = (e) => {
  const im = e.target;
  if (im.tagName !== 'IMG') return;
  const d = document.createElement('div');
  d.className = 'noimg err';
  d.style.aspectRatio = `${im.getAttribute('width') || 1}/${im.getAttribute('height') || 1}`;
  d.textContent = 'Картинка не загрузилась — проверьте ссылку';
  im.replaceWith(d);
};
$('pv').addEventListener('error', onImgError, true);
$('lib-pv').addEventListener('error', onImgError, true);
$('pv').addEventListener('blur', () => { renderInspector(); }, true);
$('insp').addEventListener('input', onField);
$('insp').addEventListener('change', onField);
$('insp').addEventListener('click', onAction);
// Оформление текста: размер (список), цвет и выравнивание (кнопки).
function setStyle(b, key, v) {
  const [which, prop] = key.split('.');
  remember(true);
  b.style = b.style || {};
  b.style[which] = { ...(b.style[which] || {}), [prop]: v };
  saveDraft(); renderPreview(); renderInspector(); renderChecks();
}
$('insp').addEventListener('click', (e) => { const el = e.target.closest('button[data-style]'); const b = blockById(sel); if (el && b) setStyle(b, el.dataset.style, el.dataset.v); });
$('insp').addEventListener('change', (e) => { const el = e.target.closest('select[data-style]'); const b = blockById(sel); if (el && b) setStyle(b, el.dataset.style, el.value); });
$('proj-name').addEventListener('input', (e) => { state.name = e.target.value; saveDraft(); });
$('library').onclick = () => openLibrary().catch((er) => er.message !== 'auth' && toast(er.message));
$('lib-q').addEventListener('input', renderLib);
$('lib-list').addEventListener('click', (e) => { const b = e.target.closest('.lib-item'); if (b) pickLib(b.dataset.kind, b.dataset.id); });
$('lib-list').addEventListener('dblclick', (e) => { const b = e.target.closest('.lib-item'); if (b && libSel) libAction('open'); });
$('lib').addEventListener('click', (e) => { const b = e.target.closest('button[data-lib]'); if (b) libAction(b.dataset.lib); });

// ---------- Перетаскивание блоков мышкой ----------
let dragId = null;
$('list').addEventListener('dragstart', (e) => { const li = e.target.closest('li'); if (!li) return; dragId = li.dataset.id; li.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
$('list').addEventListener('dragend', () => { dragId = null; document.querySelectorAll('#list li').forEach((x) => x.classList.remove('drag', 'over-top', 'over-bot')); });
$('list').addEventListener('dragover', (e) => {
  const li = e.target.closest('li'); if (!li || !dragId) return;
  e.preventDefault();
  const r = li.getBoundingClientRect(); const top = e.clientY < r.top + r.height / 2;
  document.querySelectorAll('#list li').forEach((x) => x.classList.remove('over-top', 'over-bot'));
  li.classList.add(top ? 'over-top' : 'over-bot');
});
$('list').addEventListener('drop', (e) => {
  const li = e.target.closest('li'); if (!li || !dragId) return;
  e.preventDefault();
  const r = li.getBoundingClientRect(); const top = e.clientY < r.top + r.height / 2;
  const from = state.blocks.findIndex((b) => b.id === dragId);
  if (from < 0 || li.dataset.id === dragId) return;
  remember(true);
  const [moved] = state.blocks.splice(from, 1);
  let to = state.blocks.findIndex((b) => b.id === li.dataset.id) + (top ? 0 : 1);
  state.blocks.splice(to, 0, moved);
  sel = moved.id; saveDraft(); render(); select(moved.id, true);
});
$('save').onclick = saveTemplate;
$('export').onclick = exportJson;
$('import').onclick = importJson;
$('undo').onclick = undo;
const setView = (v) => { view = v; $('v-pc').setAttribute('aria-pressed', v === 'pc'); $('v-m').setAttribute('aria-pressed', v === 'm'); renderPreview(); };
$('v-pc').onclick = () => setView('pc');
$('v-m').onclick = () => setView('m');
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.closest('input,textarea,[contenteditable]')) { e.preventDefault(); undo(); }
});

boot();
