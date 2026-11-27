// Редактор rich-контента Ozon: интерфейс.
// Один набор блоков рисуется и для ПК, и для телефона, поэтому правка в одном виде
// сразу видна в другом. Картинка для телефона подставляется из ПК, если своей нет.
import { TYPES, newBlock, toOzon, fromOzon, check, resolveImage, productUrl } from './rich.js';
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
    <li data-id="${b.id}" class="${b.id === sel ? 'on' : ''}" tabindex="0">
      <span class="nm">${esc(TYPES[b.type])}<small>${esc(blockCaption(b)) || '&nbsp;'}</small></span>
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

// Редактируемый текст прямо в предпросмотре.
const ed = (b, path, val, cls) => `<div class="${cls}" contenteditable="plaintext-only" data-b="${b.id}" data-f="${path}" spellcheck="true">${esc(val)}</div>`;

function renderPreview() {
  const pv = $('pv');
  $('frame').className = `frame ${view}`;
  if (!state.blocks.length) { pv.innerHTML = '<div class="empty">Пусто. Добавьте блок слева или выберите шаблон.</div>'; return; }
  pv.innerHTML = state.blocks.map((b) => {
    let inner = '';
    if (b.type === 'hero') inner = `${imgHtml('hero', b.img, 'Обложка')}<div class="pad c">${ed(b, 'title', b.title, 's5')}${ed(b, 'text', b.text, 's3')}</div>`;
    if (b.type === 'chess') inner = b.items.map((it, i) => `<div class="chess ${i % 2 ? 'rev' : ''}"><div class="im">${imgHtml('chess', it.img, it.title)}</div><div class="tx">${ed(b, `items.${i}.title`, it.title, 's4')}${ed(b, `items.${i}.text`, it.text, 's3')}</div></div>`).join('');
    if (b.type === 'tiles') inner = `<div class="tiles" style="--n:${Math.min(3, b.items.length) || 1}">${b.items.map((it, i) => `<div>${imgHtml('tiles', it.img, it.title)}${ed(b, `items.${i}.title`, it.title, 's4 c')}${ed(b, `items.${i}.text`, it.text, 's3 c')}</div>`).join('')}</div>`;
    if (b.type === 'roll') inner = b.items.map((it) => imgHtml('roll', it.img, it.alt || 'Картинка во всю ширину')).join('');
    if (b.type === 'text') inner = `<div class="tb ${esc(b.theme)} c">${ed(b, 'title', b.title, 's5')}${ed(b, 'text', b.text, 's3')}</div>`;
    if (b.type === 'faq') inner = b.items.map((it, i) => `<div class="faq">${ed(b, `items.${i}.q`, it.q, 's4')}${ed(b, `items.${i}.a`, it.a, 's3')}</div>`).join('');
    if (b.type === 'catalog') inner = b.items.map((it, i) => `<div class="cat"><div>${imgHtml('catalog', it.img, it.title)}</div><div>${ed(b, `items.${i}.title`, it.title, `s4 ${productUrl(it.sku) ? 'lnk' : ''}`)}${ed(b, `items.${i}.text`, it.text, 's3')}</div></div>`).join('');
    return `<div class="w ${b.id === sel ? 'on' : ''}" data-id="${b.id}"><span class="tag">${esc(TYPES[b.type])}</span>${inner}</div>`;
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
  const pcNote = img.src ? `${r.w}×${r.h}` : (img.srcM ? `берётся из телефона, ${r.w}×${r.h}` : `нужно ${r.w}×${r.h}`);
  const mNote = img.srcM ? `своя, ${r.wM}×${r.hM}` : (img.src ? `подставлена из ПК, ${r.wM}×${r.hM}` : `нужно ${r.wM}×${r.hM}`);
  return `${fld(`${base}.src`, 'Картинка для ПК — ссылка .jpg или .png', img.src, { ph: 'https://…/картинка.jpg' })}
    <div class="size ${!img.src && img.srcM ? 'sync' : ''}">${esc(pcNote)}</div>
    ${fld(`${base}.srcM`, 'Картинка для телефона — если пусто, как для ПК', img.srcM, { ph: 'необязательно' })}
    <div class="size ${img.src && !img.srcM ? 'sync' : ''}">${esc(mNote)}</div>`;
}

const ITEM_NAMES = { chess: 'Блок', tiles: 'Плитка', roll: 'Картинка', faq: 'Вопрос', catalog: 'Чай' };

function itemFields(b, it, i) {
  const p = `items.${i}`;
  if (b.type === 'chess') return fld(`${p}.title`, 'Заголовок', it.title) + fld(`${p}.text`, `Текст (${(it.text || '').length} из 260)`, it.text, { area: 1 }) + imgFields('chess', `${p}.img`, it.img);
  if (b.type === 'tiles') return fld(`${p}.title`, 'Название', it.title) + fld(`${p}.text`, 'Подпись', it.text) + fld(`${p}.sku`, 'SKU Ozon — куда ведёт плитка', it.sku, { mode: 'numeric' }) + imgFields('tiles', `${p}.img`, it.img);
  if (b.type === 'roll') return fld(`${p}.sku`, 'SKU Ozon — куда ведёт картинка', it.sku, { mode: 'numeric' }) + fld(`${p}.link`, 'Или ссылка на страницу Ozon', it.link, { ph: 'https://www.ozon.ru/…' }) + fld(`${p}.alt`, 'Описание картинки', it.alt) + imgFields('roll', `${p}.img`, it.img);
  if (b.type === 'faq') return fld(`${p}.q`, 'Вопрос', it.q) + fld(`${p}.a`, 'Ответ', it.a, { area: 1 });
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
    + `<label for="f-theme">Фон</label><select id="f-theme" data-f="theme">${[['primary', 'Серый'], ['secondary', 'Голубой'], ['tertiary', 'Тёплый'], ['default', 'Без фона']].map(([v, t]) => `<option value="${v}" ${b.theme === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  if (b.items) {
    html += b.items.map((it, i) => `<div class="grp"><div class="gh"><b>${ITEM_NAMES[b.type]} ${i + 1}</b><span>
      <button class="icon ghost" data-act="iup" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Выше">↑</button>
      <button class="icon ghost" data-act="idown" data-i="${i}" ${i < b.items.length - 1 ? '' : 'disabled'} aria-label="Ниже">↓</button>
      <button class="icon ghost danger" data-act="idel" data-i="${i}" aria-label="Удалить">×</button></span></div>${itemFields(b, it, i)}</div>`).join('');
    html += `<button class="ghost" data-act="iadd" style="margin-top:12px">Добавить: ${ITEM_NAMES[b.type].toLowerCase()}</button>`;
  }
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
  const val = e.target.value;
  setPath(b, f, val);
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
    case 'up': swap(state.blocks, n, n - 1); break;
    case 'down': swap(state.blocks, n, n + 1); break;
    case 'dup': { const c = clone(b); c.id = newBlock('text').id; state.blocks.splice(n + 1, 0, c); sel = c.id; break; }
    case 'del': state.blocks.splice(n, 1); sel = state.blocks[Math.min(n, state.blocks.length - 1)]?.id || ''; break;
    default: return;
  }
  saveDraft(); render();
}

// ---------- Шаблоны ----------
async function fillTemplates() {
  let saved = [];
  if (server) { try { saved = (await api('templates')).items || []; } catch { saved = []; } }
  else saved = Object.entries(lsGet(LOCAL, {})).map(([id, t]) => ({ id, name: t.name, updatedAt: t.updatedAt }));
  $('open').innerHTML = `<option value="">Открыть шаблон…</option>
    <optgroup label="Готовые">${Object.entries(PRESETS).map(([k, p]) => `<option value="preset:${k}">${esc(p.name)}</option>`).join('')}</optgroup>
    ${saved.length ? `<optgroup label="${server ? 'Сохранённые (общие)' : 'Сохранённые в этом браузере'}">${saved.map((t) => `<option value="saved:${esc(t.id)}">${esc(t.name)}</option>`).join('')}</optgroup>` : ''}`;
}

async function openTemplate(v) {
  if (!v) return;
  remember(true);
  if (v.startsWith('preset:')) {
    const p = PRESETS[v.slice(7)];
    state = { id: '', name: p.name, blocks: p.blocks() };
  } else {
    const id = v.slice(6);
    const t = server ? await api(`templates/${encodeURIComponent(id)}`) : lsGet(LOCAL, {})[id];
    if (!t) return toast('Шаблон не найден');
    state = { id, name: t.name, blocks: t.blocks };
  }
  sel = state.blocks[0]?.id || '';
  $('open').value = '';
  saveDraft(); render();
}

const slug = (s) => (s || 'shablon').toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'shablon';

async function saveTemplate() {
  const name = ($('proj-name').value || '').trim();
  if (!name) { $('proj-name').focus(); return toast('Впишите название шаблона'); }
  state.name = name;
  const id = state.id || `${slug(name)}-${Date.now().toString(36)}`;
  try {
    if (server) await api(`templates/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ name, blocks: state.blocks }) });
    else { const all = lsGet(LOCAL, {}); all[id] = { name, blocks: state.blocks, updatedAt: new Date().toISOString() }; lsSet(LOCAL, all); }
    state.id = id; saveDraft(); await fillTemplates();
    toast(server ? 'Сохранено — шаблон видят все в «Менеджменте»' : 'Сохранено в этом браузере');
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
$('pv').addEventListener('error', (e) => {
  const im = e.target;
  if (im.tagName !== 'IMG') return;
  const d = document.createElement('div');
  d.className = 'noimg err';
  d.style.aspectRatio = `${im.getAttribute('width') || 1}/${im.getAttribute('height') || 1}`;
  d.textContent = 'Картинка не загрузилась — проверьте ссылку';
  im.replaceWith(d);
}, true);
$('pv').addEventListener('blur', () => { renderInspector(); }, true);
$('insp').addEventListener('input', onField);
$('insp').addEventListener('change', onField);
$('insp').addEventListener('click', onAction);
$('proj-name').addEventListener('input', (e) => { state.name = e.target.value; saveDraft(); });
$('open').addEventListener('change', (e) => openTemplate(e.target.value).catch((er) => er.message !== 'auth' && toast(er.message)));
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
