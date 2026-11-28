// Цветные картинки для rich-контента: профиль вкуса и таблица.
// Ozon не даёт красить текст и фон таблиц (только 4 цвета текста и 3 фона),
// поэтому «красивый» вариант редактор рисует сам картинкой в цветах бренда.
// Картинку скачивают, загружают в конструктор rich-контента Ozon и вставляют ссылку.
import { scale } from './rich.js';

export const PALETTES = {
  shu: { many: ['#c8743a', '#6b8e23', '#8b5a2b', '#d9a441', '#a0522d', '#9c7c5c', '#5f7f3a', '#e0915a'], name: 'Шу пуэр — тёплый', bg: '#f6e7d2', card: '#fffaf2', ink: '#3a2418', mute: '#7a5c44', accents: ['#c8743a', '#6b8e23', '#8b5a2b'], empty: '#ead7bd', head: '#3a2418', headInk: '#fff6e8', row: '#fbf1e3' },
  gaba: { many: ['#2f8f8a', '#b8864b', '#5d7a8c', '#7fae9f', '#8c6d4f', '#3f6f8f', '#c9a36b', '#4f9c94'], name: 'ГАБА — бирюза и камень', bg: '#ece0d0', card: '#fbf7f1', ink: '#2b2a26', mute: '#6b6459', accents: ['#2f8f8a', '#b8864b', '#5d7a8c'], empty: '#ddd0bd', head: '#2f6f6b', headInk: '#ffffff', row: '#f4ece1' },
  green: { many: ['#4c9a2a', '#d9a441', '#2e7d6b', '#8bbf5a', '#b5862c', '#5b9c86', '#a9c46c', '#7a9a3a'], name: 'Зелёный чай', bg: '#eaf4e2', card: '#f8fcf4', ink: '#1f3a1a', mute: '#5b7552', accents: ['#4c9a2a', '#d9a441', '#2e7d6b'], empty: '#d3e6c6', head: '#3f7f24', headInk: '#ffffff', row: '#f0f7ea' },
  ozon: { many: ['#005bff', '#f91155', '#10c44c', '#ff9900', '#7b61ff', '#00a3e0', '#ff5c8a', '#2bb673'], name: 'Ozon — голубой', bg: '#eef5ff', card: '#ffffff', ink: '#001a34', mute: '#5b6b7c', accents: ['#005bff', '#f91155', '#10c44c'], empty: '#d6e4fb', head: '#005bff', headInk: '#ffffff', row: '#f5f9ff' },
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

// ---------- Инфографика вкуса: 6 видов ----------

// Общая рамка: фон, белая карточка, заголовок. Возвращает y, с которого рисовать.
function frame(ctx, W, H, P, title, mobile) {
  const pad = mobile ? 40 : 80;
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = P.card; roundRect(ctx, pad / 2, pad / 2, W - pad, H - pad, mobile ? 24 : 36); ctx.fill();
  if (!title) return pad;
  const px = mobile ? 40 : 56;
  ctx.fillStyle = P.ink; ctx.font = font(px, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, W / 2, pad + px);
  return pad + px * 1.6;
}
const headH = (title, mobile) => (mobile ? 40 : 80) + (title ? (mobile ? 40 : 56) * 1.6 : 0);

// Легенда: цветной квадратик и название чая, по центру.
function legend(ctx, W, y, items, px, ink) {
  ctx.font = font(px, 500); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const sw = px * 0.75;
  const widths = items.map((it) => sw + 12 + ctx.measureText(it.t).width);
  const total = widths.reduce((a, w) => a + w, 0) + 36 * (items.length - 1);
  let x = W / 2 - total / 2;
  items.forEach((it, i) => {
    ctx.fillStyle = it.col; roundRect(ctx, x, y - sw * 0.9, sw, sw, sw / 3); ctx.fill();
    ctx.fillStyle = ink; ctx.fillText(it.t, x + sw + 12, y);
    x += widths[i] + 36;
  });
}
const teaItems = (b, P) => b.teas.map((t, i) => ({ t: t.name || `Чай ${i + 1}`, col: P.accents[i % P.accents.length] }));

function radarPicture(b, mobile) {
  const P = PALETTES[b.palette] || PALETTES.shu;
  const W = mobile ? 640 : 1416;
  const lab = mobile ? 24 : 34;
  // Радиус подбираем так, чтобы подписи слева и справа не вылезли за край.
  const m0 = canvas(10, 10).getContext('2d'); m0.font = font(lab, 500);
  const widest = Math.max(0, ...b.props.map((p) => m0.measureText(`${p.icon ? `${p.icon} ` : ''}${p.name}`).width));
  const R = Math.max(mobile ? 110 : 180, Math.min(mobile ? 190 : 280, W / 2 - (mobile ? 40 : 80) - lab * 0.9 - widest - 12));
  const multi = b.teas.length > 1;
  const top = headH(b.title, mobile) + (multi ? lab * 2 : 0);
  const cy = top + R + lab * 2.2;
  const H = Math.round(cy + R + lab * 2.6 + (mobile ? 40 : 80));
  const c = canvas(W, H); const ctx = c.getContext('2d');
  frame(ctx, W, H, P, b.title, mobile);
  if (multi) legend(ctx, W, top - lab * 0.6, teaItems(b, P), lab, P.ink);
  const cx = W / 2; const n = Math.max(3, b.props.length); const max = Number(b.max) || 5;
  const pt = (i, v) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
  // Сетка
  ctx.strokeStyle = P.empty; ctx.lineWidth = 2;
  for (let k = 1; k <= max; k++) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const [x, y] = pt(i, k / max); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.closePath(); ctx.stroke();
  }
  for (let i = 0; i < n; i++) { const [x, y] = pt(i, 1); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); }
  // Фигуры чаёв
  b.teas.forEach((_, ti) => {
    const col = P.accents[ti % P.accents.length];
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const p = b.props[i]; const v = p ? Math.max(0, Math.min(max, Number(p.vals[ti]) || 0)) / max : 0; const [x, y] = pt(i, v); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.closePath();
    ctx.globalAlpha = 0.28; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = col; ctx.lineWidth = mobile ? 4 : 6; ctx.lineJoin = 'round'; ctx.stroke();
    for (let i = 0; i < b.props.length; i++) { const v = Math.max(0, Math.min(max, Number(b.props[i].vals[ti]) || 0)) / max; const [x, y] = pt(i, v); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, mobile ? 6 : 9, 0, Math.PI * 2); ctx.fill(); }
  });
  // Подписи лучей
  ctx.fillStyle = P.ink; ctx.font = font(lab, 500); ctx.textBaseline = 'middle';
  b.props.forEach((p, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const [x, y] = [cx + Math.cos(a) * (R + lab * 0.9), cy + Math.sin(a) * (R + lab * 0.9)];
    const cos = Math.cos(a);
    ctx.textAlign = Math.abs(cos) < 0.2 ? 'center' : cos > 0 ? 'left' : 'right';
    const dy = Math.abs(cos) < 0.2 ? (Math.sin(a) < 0 ? -lab * 0.3 : lab * 0.4) : 0;
    ctx.fillText(`${p.icon ? `${p.icon} ` : ''}${p.name}`, x, y + dy);
  });
  ctx.textBaseline = 'alphabetic';
  return c;
}

function slidersPicture(b, mobile) {
  const P = PALETTES[b.palette] || PALETTES.shu;
  const W = mobile ? 640 : 1416;
  const pad = mobile ? 40 : 80;
  const lab = mobile ? 28 : 36;
  const multi = b.teas.length > 1;
  const top = headH(b.title, mobile) + (multi ? lab * 1.8 : 0);
  const rowH = mobile ? lab * 1.4 + 50 : 90;
  const H = Math.round(top + b.sliders.length * rowH + pad * 1.2);
  const c = canvas(W, H); const ctx = c.getContext('2d');
  frame(ctx, W, H, P, b.title, mobile);
  if (multi) legend(ctx, W, top - lab * 0.6, teaItems(b, P), lab * 0.9, P.ink);
  const labW = mobile ? 0 : 300;
  const x0 = pad + (mobile ? 0 : labW + 20); const x1 = W - pad - (mobile ? 0 : labW + 20);
  let y = top;
  b.sliders.forEach((s) => {
    ctx.font = font(lab, 500); ctx.fillStyle = P.ink;
    let ty;
    if (mobile) { ctx.textAlign = 'left'; ctx.fillText(s.left, pad, y + lab); ctx.textAlign = 'right'; ctx.fillText(s.right, W - pad, y + lab); ty = y + lab * 1.4 + 20; }
    else { ty = y + rowH / 2; ctx.textAlign = 'right'; ctx.fillText(s.left, x0 - 28, ty + lab * 0.35); ctx.textAlign = 'left'; ctx.fillText(s.right, x1 + 28, ty + lab * 0.35); }
    ctx.fillStyle = P.empty; roundRect(ctx, x0, ty - 7, x1 - x0, 14, 7); ctx.fill();
    // деления
    ctx.fillStyle = P.card; for (let k = 1; k < 10; k++) ctx.fillRect(x0 + ((x1 - x0) * k) / 10 - 1, ty - 7, 2, 14);
    b.teas.forEach((_, ti) => {
      const v = Math.max(0, Math.min(10, Number(s.vals[ti]) || 0));
      const x = x0 + ((x1 - x0) * v) / 10;
      ctx.fillStyle = P.accents[ti % P.accents.length]; ctx.beginPath(); ctx.arc(x, ty, mobile ? 16 : 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = P.card; ctx.lineWidth = mobile ? 4 : 6; ctx.stroke();
    });
    y += rowH;
  });
  return c;
}

function wheelPicture(b, mobile) {
  const P = PALETTES[b.palette] || PALETTES.shu;
  const W = mobile ? 640 : 1416;
  const pad = mobile ? 40 : 80;
  const R = mobile ? 200 : 280; const r0 = R * 0.55;
  const lab = mobile ? 28 : 38;
  const segs = b.segs.filter((s) => Number(s.val) > 0);
  const total = segs.reduce((a, s) => a + Number(s.val), 0) || 1;
  const top = headH(b.title, mobile);
  const legRows = mobile ? Math.ceil(segs.length / 2) : segs.length;
  const legH = legRows * lab * 1.7;
  const H = Math.round(mobile ? top + R * 2 + 50 + legH + pad : top + Math.max(R * 2, legH) + pad * 1.4);
  const c = canvas(W, H); const ctx = c.getContext('2d');
  frame(ctx, W, H, P, b.title, mobile);
  const cx = mobile ? W / 2 : pad + 80 + R; const cy = top + R;
  let a = -Math.PI / 2;
  segs.forEach((s, i) => {
    const da = (2 * Math.PI * Number(s.val)) / total;
    ctx.beginPath(); ctx.arc(cx, cy, R, a, a + da); ctx.arc(cx, cy, r0, a + da, a, true); ctx.closePath();
    ctx.fillStyle = P.many[i % P.many.length]; ctx.fill();
    ctx.strokeStyle = P.card; ctx.lineWidth = mobile ? 4 : 6; ctx.stroke();
    a += da;
  });
  if (b.center) { ctx.fillStyle = P.ink; ctx.font = font(lab, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; wrap(ctx, b.center, r0 * 1.7).forEach((ln, i, arr) => ctx.fillText(ln, cx, cy + (i - (arr.length - 1) / 2) * lab * 1.15)); ctx.textBaseline = 'alphabetic'; }
  // Легенда с долями
  ctx.font = font(lab, 500); ctx.textAlign = 'left';
  segs.forEach((s, i) => {
    let x; let y;
    if (mobile) { x = pad + (i % 2) * ((W - pad * 2) / 2); y = top + R * 2 + 50 + Math.floor(i / 2) * lab * 1.7 + lab; }
    else { x = cx + R + 110; y = cy - legH / 2 + i * lab * 1.7 + lab; }
    const sw = lab * 0.8;
    ctx.fillStyle = P.many[i % P.many.length]; roundRect(ctx, x, y - sw * 0.85, sw, sw, sw / 3); ctx.fill();
    ctx.fillStyle = P.ink; ctx.fillText(s.name, x + sw + 14, y);
    if (!mobile) { ctx.fillStyle = P.mute; ctx.fillText(`${Math.round((Number(s.val) / total) * 100)}%`, x + sw + 14 + ctx.measureText(s.name).width + 18, y); }
  });
  return c;
}

function mapPicture(b, mobile) {
  const P = PALETTES[b.palette] || PALETTES.shu;
  const W = mobile ? 640 : 1416;
  const lab = mobile ? 26 : 34;
  const top = headH(b.title, mobile) + lab * 1.4;
  const S = mobile ? 460 : 640;
  const x0 = (W - S) / 2; const y0 = top;
  const H = Math.round(y0 + S + lab * 2.4 + (mobile ? 40 : 80));
  const c = canvas(W, H); const ctx = c.getContext('2d');
  frame(ctx, W, H, P, b.title, mobile);
  // Четверти — лёгкая заливка
  ctx.fillStyle = P.row; roundRect(ctx, x0, y0, S, S, 24); ctx.fill();
  ctx.strokeStyle = P.empty; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x0, y0 + S / 2); ctx.lineTo(x0 + S, y0 + S / 2); ctx.moveTo(x0 + S / 2, y0); ctx.lineTo(x0 + S / 2, y0 + S); ctx.stroke();
  // Подписи осей
  ctx.fillStyle = P.mute; ctx.font = font(lab, 500);
  ctx.textAlign = 'center'; ctx.fillText(`↑ ${b.axes.yt}`, x0 + S / 2, y0 - lab * 0.5); ctx.fillText(`↓ ${b.axes.yb}`, x0 + S / 2, y0 + S + lab * 1.2);
  if (mobile) { ctx.textAlign = 'left'; ctx.fillText(`← ${b.axes.xl}`, x0 + 10, y0 + S / 2 - 12); ctx.textAlign = 'right'; ctx.fillText(`${b.axes.xr} →`, x0 + S - 10, y0 + S / 2 - 12); }
  else { ctx.textAlign = 'right'; ctx.fillText(`← ${b.axes.xl}`, x0 - 24, y0 + S / 2 + lab * 0.35); ctx.textAlign = 'left'; ctx.fillText(`${b.axes.xr} →`, x0 + S + 24, y0 + S / 2 + lab * 0.35); }
  // Точки чаёв
  b.points.forEach((p, i) => {
    const x = x0 + (S * Math.max(0, Math.min(10, Number(p.x) || 0))) / 10;
    const y = y0 + S - (S * Math.max(0, Math.min(10, Number(p.y) || 0))) / 10;
    const col = P.many[i % P.many.length];
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, mobile ? 14 : 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.card; ctx.lineWidth = mobile ? 4 : 6; ctx.stroke();
    ctx.font = font(lab, 700); ctx.fillStyle = P.ink;
    const right = x < x0 + S * 0.7;
    ctx.textAlign = right ? 'left' : 'right';
    ctx.fillText(p.name, x + (right ? 1 : -1) * (mobile ? 24 : 32), y + lab * 0.35);
  });
  return c;
}

function notesPicture(b, mobile) {
  const P = PALETTES[b.palette] || PALETTES.shu;
  const W = mobile ? 640 : 1416;
  const pad = mobile ? 40 : 80;
  const px = mobile ? 30 : 44;
  const chipH = px * 2; const gap = mobile ? 14 : 22;
  const c0 = canvas(10, 10).getContext('2d'); c0.font = font(px, 500);
  const chips = b.notes.map((n) => { const t = `${n.icon ? `${n.icon} ` : ''}${n.name}`; return { t, w: c0.measureText(t).width + px * 1.6 }; });
  // раскладка по строкам
  const maxW = W - pad * 2 - 40; const lines = [[]]; let lw = 0;
  chips.forEach((ch) => { if (lw + ch.w > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push(ch); lw += ch.w + gap; });
  const top = headH(b.title, mobile);
  const H = Math.round(top + lines.length * (chipH + gap) + pad);
  const c = canvas(W, H); const ctx = c.getContext('2d');
  frame(ctx, W, H, P, b.title, mobile);
  let y = top; let k = 0;
  lines.forEach((line) => {
    const tw = line.reduce((a, ch) => a + ch.w, 0) + gap * (line.length - 1);
    let x = (W - tw) / 2;
    line.forEach((ch) => {
      const col = P.many[k % P.many.length]; k += 1;
      ctx.fillStyle = col; roundRect(ctx, x, y, ch.w, chipH, chipH / 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = font(px, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch.t, x + ch.w / 2, y + chipH / 2 + 2); ctx.textBaseline = 'alphabetic';
      x += ch.w + gap;
    });
    y += chipH + gap;
  });
  return c;
}

export function chartPicture(b, mobile = false) {
  if (b.kind === 'radar') return radarPicture(b, mobile);
  if (b.kind === 'sliders') return slidersPicture(b, mobile);
  if (b.kind === 'wheel') return wheelPicture(b, mobile);
  if (b.kind === 'map') return mapPicture(b, mobile);
  if (b.kind === 'notes') return notesPicture(b, mobile);
  return tastePicture({ title: b.title, palette: b.palette, max: b.max, teas: b.teas, rows: b.props }, mobile);
}

export const pictureOf = (b, mobile) => (b.type === 'chart' ? chartPicture(b, mobile) : b.type === 'taste' ? tastePicture(b, mobile) : tablePicture(b, mobile));

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
