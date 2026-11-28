// Цветные картинки для rich-контента: профиль вкуса и таблица.
// Ozon не даёт красить текст и фон таблиц (только 4 цвета текста и 3 фона),
// поэтому «красивый» вариант редактор рисует сам картинкой в цветах бренда.
// Картинку скачивают, загружают в конструктор rich-контента Ozon и вставляют ссылку.
import { scale } from './rich.js';

export const PALETTES = {
  shu: { name: 'Шу пуэр — тёплый', bg: '#f6e7d2', card: '#fffaf2', ink: '#3a2418', mute: '#7a5c44', accents: ['#c8743a', '#6b8e23', '#8b5a2b'], empty: '#ead7bd', head: '#3a2418', headInk: '#fff6e8', row: '#fbf1e3' },
  gaba: { name: 'ГАБА — бирюза и камень', bg: '#ece0d0', card: '#fbf7f1', ink: '#2b2a26', mute: '#6b6459', accents: ['#2f8f8a', '#b8864b', '#5d7a8c'], empty: '#ddd0bd', head: '#2f6f6b', headInk: '#ffffff', row: '#f4ece1' },
  green: { name: 'Зелёный чай', bg: '#eaf4e2', card: '#f8fcf4', ink: '#1f3a1a', mute: '#5b7552', accents: ['#4c9a2a', '#d9a441', '#2e7d6b'], empty: '#d3e6c6', head: '#3f7f24', headInk: '#ffffff', row: '#f0f7ea' },
  ozon: { name: 'Ozon — голубой', bg: '#eef5ff', card: '#ffffff', ink: '#001a34', mute: '#5b6b7c', accents: ['#005bff', '#f91155', '#10c44c'], empty: '#d6e4fb', head: '#005bff', headInk: '#ffffff', row: '#f5f9ff' },
};

const FONT = 'Onest, "Segoe UI", Arial, sans-serif';
const font = (px, w = 500) => `${w} ${px}px ${FONT}`;

// Шрифт Onest подгружаем заранее, иначе первая картинка нарисуется запасным шрифтом.
export const fontsReady = () => (document.fonts ? Promise.all([document.fonts.load(font(40, 700)), document.fonts.load(font(40, 500))]).catch(() => {}) : Promise.resolve());

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Перенос текста по словам в заданную ширину.
function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text || '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Профиль вкуса: название свойства и цветная полоска из делений.
// mobile — узкая картинка 640 px: подпись над полосками.
export function tastePicture(b, mobile = false) {
  const P = PALETTES[b.palette] || PALETTES.shu;
  const W = mobile ? 640 : 1416;
  const pad = mobile ? 40 : 80;
  const s = mobile ? 0.62 : 1;
  const teas = b.teas.length ? b.teas : [{ name: '' }];
  const multi = teas.length > 1;
  const titlePx = Math.round(56 * s + (mobile ? 6 : 0));
  const labelPx = Math.round(36 * s + (mobile ? 4 : 0));
  const segH = Math.round(30 * s + (mobile ? 4 : 0));
  const gapBar = Math.round(12 * s);
  const labelW = mobile ? 0 : 420;
  const rowGap = Math.round(36 * s);
  const legendH = multi ? Math.round(56 * s) : 0;
  const barsH = teas.length * segH + (teas.length - 1) * gapBar;
  const rowH = mobile ? labelPx * 1.3 + 14 + barsH : Math.max(labelPx * 1.3, barsH);
  const H = Math.round(pad + titlePx * 1.3 + 30 * s + legendH + b.rows.length * rowH + (b.rows.length - 1) * rowGap + pad);
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
  // Карточка
  ctx.fillStyle = P.card; roundRect(ctx, pad / 2, pad / 2, W - pad, H - pad, mobile ? 24 : 36); ctx.fill();
  let y = pad + titlePx;
  ctx.fillStyle = P.ink; ctx.font = font(titlePx, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(b.title || 'Профиль вкуса', W / 2, y);
  y += 30 * s + titlePx * 0.3;
  // Легенда для сравнения нескольких чаёв
  if (multi) {
    ctx.font = font(labelPx * 0.85, 500);
    const items = teas.map((t, i) => ({ t: t.name || `Чай ${i + 1}`, col: P.accents[i % P.accents.length] }));
    const sw = labelPx * 0.7;
    const total = items.reduce((a, it) => a + sw + 12 + ctx.measureText(it.t).width + 36, -36);
    let x = W / 2 - total / 2;
    ctx.textAlign = 'left';
    for (const it of items) {
      ctx.fillStyle = it.col; roundRect(ctx, x, y - sw * 0.9, sw, sw, sw / 3); ctx.fill();
      ctx.fillStyle = P.ink; ctx.fillText(it.t, x + sw + 12, y);
      x += sw + 12 + ctx.measureText(it.t).width + 36;
    }
    y += legendH - labelPx * 0.4;
  }
  const max = Number(b.max) || 5;
  const barX = mobile ? pad : pad + labelW;
  const barW = W - pad - barX;
  const segGap = Math.round((max > 5 ? 6 : 10) * s);
  const segW = (barW - segGap * (max - 1)) / max;
  for (const r of b.rows) {
    ctx.textAlign = 'left'; ctx.fillStyle = P.ink; ctx.font = font(labelPx, 500);
    const label = `${r.icon ? `${r.icon} ` : ''}${r.name || ''}`;
    let by;
    if (mobile) {
      ctx.fillText(label, pad, y + labelPx);
      by = y + labelPx * 1.3 + 14;
    } else {
      ctx.fillText(label, pad, y + rowH / 2 + labelPx * 0.35);
      by = y + (rowH - barsH) / 2;
    }
    teas.forEach((_, ti) => {
      const v = Math.max(0, Math.min(max, Math.round(Number(r.vals[ti]) || 0)));
      for (let k = 0; k < max; k++) {
        ctx.fillStyle = k < v ? P.accents[ti % P.accents.length] : P.empty;
        roundRect(ctx, barX + k * (segW + segGap), by + ti * (segH + gapBar), segW, segH, Math.min(segH / 2, 14)); ctx.fill();
      }
    });
    y += rowH + rowGap;
  }
  return c;
}

// Таблица: тёмная шапка, строки «зеброй» в цветах бренда, скруглённые углы.
export function tablePicture(b, mobile = false) {
  const P = PALETTES[b.palette] || PALETTES.shu;
  const W = mobile ? 640 : 1416;
  const pad = mobile ? 32 : 72;
  const s = mobile ? 0.62 : 1;
  const titlePx = Math.round(52 * s + (mobile ? 6 : 0));
  const cellPx = Math.round(32 * s + (mobile ? 4 : 0));
  const cellPad = Math.round(24 * s);
  const cols = Math.max(1, b.head.length);
  const tw = W - pad * 2;
  const colW = tw / cols;
  const c0 = canvas(10, 10).getContext('2d');
  const linesOf = (txt, bold) => { c0.font = font(cellPx, bold ? 700 : 500); return wrap(c0, String(txt ?? '').replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1'), colW - cellPad * 2); };
  const lh = cellPx * 1.3;
  const rows = [];
  if (!b.hideHead) rows.push({ head: true, cells: b.head.map((h) => linesOf(h, true)) });
  b.rows.forEach((r) => rows.push({ cells: b.head.map((_, i) => linesOf(r[i], false)) }));
  rows.forEach((r) => { r.h = Math.max(...r.cells.map((l) => l.length)) * lh + cellPad * 2 - lh * 0.3; });
  const hasTitle = Boolean((b.title || '').trim());
  const top = pad + (hasTitle ? titlePx * 1.6 : 0);
  const H = Math.round(top + rows.reduce((a, r) => a + r.h, 0) + pad);
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
  if (hasTitle) {
    ctx.fillStyle = P.ink; ctx.font = font(titlePx, 700); ctx.textAlign = 'center';
    ctx.fillText(b.title, W / 2, pad + titlePx);
  }
  // Таблица с закруглёнными углами
  ctx.save();
  roundRect(ctx, pad, top, tw, H - top - pad, mobile ? 18 : 28); ctx.clip();
  let y = top;
  rows.forEach((r, ri) => {
    ctx.fillStyle = r.head ? P.head : ((ri - (b.hideHead ? 0 : 1)) % 2 ? P.row : P.card);
    ctx.fillRect(pad, y, tw, r.h);
    r.cells.forEach((lines, ci) => {
      ctx.fillStyle = r.head ? P.headInk : (ci === 0 && b.hideHead ? P.mute : P.ink);
      ctx.font = font(cellPx, r.head || (ci === 0 && !b.hideHead) ? 700 : 500);
      ctx.textAlign = 'left';
      lines.forEach((ln, li) => ctx.fillText(ln, pad + ci * colW + cellPad, y + cellPad + cellPx * 0.8 + li * lh));
    });
    y += r.h;
  });
  ctx.restore();
  return c;
}

export const pictureOf = (b, mobile) => (b.type === 'taste' ? tastePicture(b, mobile) : tablePicture(b, mobile));

// Скачать картинку файлом PNG.
export function downloadPicture(b, mobile) {
  const c = pictureOf(b, mobile);
  const name = `${(b.title || (b.type === 'taste' ? 'profil-vkusa' : 'tablica')).toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '') || 'kartinka'}-${mobile ? 'telefon-640' : 'pk-1416'}.png`;
  return new Promise((ok) => c.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    ok({ name, w: c.width, h: c.height });
  }, 'image/png'));
}

export { scale };
